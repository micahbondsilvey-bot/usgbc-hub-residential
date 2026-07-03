import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/enums';
import { Invoice } from '../projects/invoice.entity';
import { CertificationAgreement } from '../projects/certification-agreement.entity';
import { ProjectMembership } from '../membership/project-membership.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Review } from '../review/review.entity';
import { ReviewOutcome, ReviewStatus } from '../review/enums';
import { SubmittalQualityScore } from '../review/submittal-quality-score.entity';
import { Submittal } from '../workbook/entities/submittal.entity';
import { VerificationNote } from '../workbook/entities/verification-note.entity';
import { NoteColumn } from '../workbook/enums';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMembership) private readonly memberships: Repository<ProjectMembership>,
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(CertificationAgreement)
    private readonly agreements: Repository<CertificationAgreement>,
    @InjectRepository(SubmittalQualityScore)
    private readonly qualityScores: Repository<SubmittalQualityScore>,
    @InjectRepository(Submittal) private readonly submittals: Repository<Submittal>,
    @InjectRepository(VerificationNote) private readonly notes: Repository<VerificationNote>,
  ) {}

  async buildProjectDashboard(actor: AuthUser): Promise<{ items: unknown[] }> {
    const projects = await this.projectsForRole(actor.id, ProjectRole.PROJECT_TEAM);
    const items = [];
    for (const project of projects) items.push(await this.baseItem(project));
    return { items };
  }

  async buildGreenRaterDashboard(actor: AuthUser): Promise<{ items: unknown[] }> {
    const projects = await this.projectsForRole(actor.id, ProjectRole.GREEN_RATER);
    const items = [];
    for (const project of projects) {
      const base = await this.baseItem(project);
      const workbookProgress = await this.workbookProgress(project.id);
      const latestQualityScore = await this.latestQualityScore(project.id);
      items.push({ ...base, workbookProgress, latestQualityScore });
    }
    return { items };
  }

  async buildReviewerDashboard(actor: AuthUser): Promise<{ buckets: Record<string, unknown[]> }> {
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    let reviewRows: Review[];
    if (isAdmin) {
      reviewRows = await this.reviews.find({ order: { submittedAt: 'DESC' } });
    } else {
      const projectIds = await this.projectIdsForRole(actor.id, ProjectRole.REVIEWER);
      reviewRows =
        projectIds.length === 0
          ? []
          : await this.reviews.find({ order: { submittedAt: 'DESC' } }).then((all) =>
              all.filter((r) => projectIds.includes(r.projectId)),
            );
    }

    const buckets: Record<string, unknown[]> = {
      [ReviewStatus.OPEN]: [],
      [ReviewStatus.SUBMITTED]: [],
      [ReviewStatus.DECIDED]: [],
      [ReviewStatus.CONFIRMED]: [],
      [ReviewStatus.RETURNED]: [],
    };
    for (const review of reviewRows) {
      const project = await this.projects.findOne({ where: { id: review.projectId } });
      if (!project) continue;
      const rollup = await this.scorecardRollup(project.id);
      const latestQualityScore = await this.latestQualityScore(project.id);
      buckets[review.status].push({
        review,
        project: {
          id: project.id,
          gbciDisplayId: project.gbciDisplayId,
          name: project.name,
          status: project.status,
          isPortfolioAnchor: project.isPortfolioAnchor,
        },
        scorecardRollup: rollup,
        latestQualityScore: latestQualityScore
          ? { score: latestQualityScore.score, enteredAt: latestQualityScore.enteredAt.toISOString() }
          : null,
      });
    }
    return { buckets };
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async projectsForRole(userId: string, role: ProjectRole): Promise<Project[]> {
    const ids = await this.projectIdsForRole(userId, role);
    if (ids.length === 0) return [];
    const projects = await this.projects.find({ order: { createdAt: 'DESC' } });
    return projects.filter((p) => ids.includes(p.id));
  }

  private async projectIdsForRole(userId: string, role: ProjectRole): Promise<string[]> {
    const rows = await this.memberships.find({
      where: { userId, projectRole: role, revokedAt: IsNull() },
    });
    return rows.filter((m) => m.acceptedAt !== null).map((m) => m.projectId);
  }

  private async baseItem(project: Project): Promise<Record<string, unknown>> {
    const rollup = await this.scorecardRollup(project.id);
    const latestReview = await this.latestReview(project.id);
    const agreement = await this.agreements.findOne({ where: { projectId: project.id } });
    const invoice = await this.invoices.findOne({ where: { projectId: project.id } });
    const outstandingActions = await this.computeOutstandingActions(
      project,
      latestReview,
      agreement,
      invoice,
    );
    return {
      project,
      attemptedTotal: rollup.attemptedTotal,
      awardedTotal: rollup.awardedTotal,
      outstandingActions,
      latestReview: latestReview
        ? {
            reviewId: latestReview.id,
            reviewDisplayId: latestReview.displayId,
            phase: latestReview.phase,
            status: latestReview.status,
          }
        : null,
    };
  }

  private async computeOutstandingActions(
    project: Project,
    latestReview: Review | null,
    agreement: CertificationAgreement | null,
    invoice: Invoice | null,
  ): Promise<Array<Record<string, unknown>>> {
    const actions: Array<Record<string, unknown>> = [];
    if (!agreement) actions.push({ kind: 'AGREEMENT_UNSIGNED' });
    if (invoice && invoice.paidAt === null) {
      actions.push({
        kind: 'INVOICE_UNPAID',
        invoiceDisplayId: invoice.displayId,
        totalCents: invoice.totalCents,
      });
    }
    if (project.status === ProjectStatus.REGISTERED && !latestReview) {
      actions.push({ kind: 'PRELIM_NOT_SUBMITTED' });
    }
    if (
      latestReview &&
      latestReview.status === ReviewStatus.RETURNED &&
      (latestReview.outcome === ReviewOutcome.PASSED ||
        latestReview.outcome === ReviewOutcome.PASSED_WITH_ISSUES) &&
      project.status !== ProjectStatus.CERTIFIED
    ) {
      actions.push({
        kind: 'REVIEW_AWAITING_ACCEPT',
        reviewId: latestReview.id,
        reviewDisplayId: latestReview.displayId,
        phase: latestReview.phase,
        outcome: latestReview.outcome,
      });
    }
    const coverage = await this.submittalCoverage(project.id);
    if (coverage.attempted > 0 && coverage.withSubmittal / coverage.attempted < 0.25) {
      actions.push({
        kind: 'WORKBOOK_PROGRESS_LOW',
        percentAttemptedComplete: Math.round((coverage.withSubmittal / coverage.attempted) * 100),
      });
    }
    return actions;
  }

  private async scorecardRollup(
    projectId: string,
  ): Promise<{ attemptedTotal: number; verifiedTotal: number; awardedTotal: number }> {
    const rows = await this.entries.find({ where: { projectId, attempted: true } });
    return {
      attemptedTotal: rows.reduce((a, e) => a + e.attemptedPoints, 0),
      verifiedTotal: rows.reduce((a, e) => a + e.verifiedPoints, 0),
      awardedTotal: rows.reduce((a, e) => a + e.awardedPoints, 0),
    };
  }

  private async latestReview(projectId: string): Promise<Review | null> {
    const rows = await this.reviews.find({
      where: { projectId },
      order: { submittedAt: 'DESC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  private async latestQualityScore(projectId: string): Promise<SubmittalQualityScore | null> {
    const rows = await this.qualityScores.find({
      where: { projectId },
      order: { enteredAt: 'DESC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  private async submittalCoverage(
    projectId: string,
  ): Promise<{ attempted: number; withSubmittal: number }> {
    const attempted = await this.entries.count({ where: { projectId, attempted: true } });
    const submittals = await this.submittals.find({
      where: { projectId, archivedAt: IsNull() },
    });
    const credits = new Set(submittals.map((s) => s.creditId));
    return { attempted, withSubmittal: credits.size };
  }

  private async workbookProgress(projectId: string): Promise<Record<string, number>> {
    const totalAttempted = await this.entries.count({ where: { projectId, attempted: true } });
    const submittals = await this.submittals.find({
      where: { projectId, archivedAt: IsNull() },
    });
    const creditsWithSubmittal = new Set(submittals.map((s) => s.creditId)).size;
    const grNotes = await this.notes.find({
      where: { projectId, column: NoteColumn.GREEN_RATER },
    });
    const creditsWithGreenRaterNote = new Set(
      grNotes.filter((n) => n.body != null && n.body !== '').map((n) => n.creditId),
    ).size;
    return {
      creditsAttempted: totalAttempted,
      creditsWithSubmittal,
      creditsWithGreenRaterNote,
      totalAttempted,
    };
  }
}
