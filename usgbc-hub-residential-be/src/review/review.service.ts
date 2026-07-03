import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Review } from './review.entity';
import { SubmittalQualityScore } from './submittal-quality-score.entity';
import { ReviewOutcome, ReviewPhase, ReviewStatus } from './enums';
import { assertReviewTransition } from './review-status.machine';
import { ReviewNumberGenerator } from './review-number.generator';
import { ReviewReportService } from './review-report.service';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { ProjectsService } from '../projects/projects.service';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/enums';
import { MembershipService } from '../membership/membership.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import { NotificationGateway } from '../common/notifications-stub/notification.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationKind } from '../notifications/enums/notification.enums';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ConfirmReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(SubmittalQualityScore)
    private readonly qualityScores: Repository<SubmittalQualityScore>,
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    private readonly projects: ProjectsService,
    private readonly reviewNumbers: ReviewNumberGenerator,
    private readonly report: ReviewReportService,
    private readonly membership: MembershipService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly auditStamp: AuditStampHelper,
    private readonly notifications: NotificationGateway,
    private readonly notificationFramework: NotificationsService,
  ) {}

  // ── reads ─────────────────────────────────────────────────────────

  async list(projectId: string, actor: AuthUser): Promise<Review[]> {
    await this.assertMember(actor, projectId);
    return this.reviews.find({ where: { projectId }, order: { submittedAt: 'DESC' } });
  }

  async get(projectId: string, reviewId: string, actor: AuthUser): Promise<Review> {
    await this.assertMember(actor, projectId);
    const review = await this.reviews.findOne({ where: { id: reviewId, projectId } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async getReport(projectId: string, reviewId: string, actor: AuthUser): Promise<string> {
    const review = await this.get(projectId, reviewId, actor);
    return review.reportMarkdown ?? '# Report not yet generated';
  }

  async listQualityScores(projectId: string, actor: AuthUser): Promise<SubmittalQualityScore[]> {
    await this.assertMember(actor, projectId);
    return this.qualityScores.find({ where: { projectId }, order: { enteredAt: 'DESC' } });
  }

  // ── submit (BL-1) ──────────────────────────────────────────────────

  async submit(projectId: string, phase: ReviewPhase, actor: AuthUser): Promise<Review> {
    await this.assertSubmittable(projectId, phase, actor);
    const project = await this.projects.findById(projectId);
    const existing = await this.reviews.findOne({ where: { projectId, phase } });

    const review = await this.dataSource.transaction(async (manager) => {
      let row: Review;
      if (existing && existing.status === ReviewStatus.RETURNED) {
        assertReviewTransition(existing.status, ReviewStatus.SUBMITTED);
        existing.status = ReviewStatus.SUBMITTED;
        existing.submittedAt = new Date();
        existing.submittedByUserId = actor.id;
        existing.outcome = null;
        existing.confirmedAt = null;
        existing.confirmedByUserId = null;
        existing.returnedAt = null;
        existing.returnedByUserId = null;
        existing.reportMarkdown = null;
        existing.reportGeneratedAt = null;
        existing.version += 1;
        row = await manager.save(existing);
      } else {
        const displayId = await this.reviewNumbers.allocate(manager);
        const created = manager.create(Review, {
          displayId,
          projectId,
          phase,
          status: ReviewStatus.SUBMITTED,
          submittedAt: new Date(),
          submittedByUserId: actor.id,
          version: 1,
        });
        this.auditStamp.stampCreate(created, actor.id);
        row = await manager.save(created);
      }
      await this.projects.transitionStatus(projectId, ProjectStatus.UNDER_REVIEW, actor.id, manager);
      return row;
    });

    await this.audit.record({
      entityType: 'Review.submitted',
      entityId: review.id,
      action: AuditAction.CREATE,
      after: { phase, displayId: review.displayId },
    });
    this.notifyMembers(project.name, 'submission-confirmed', `Project ${project.name} submitted for ${phase} review.`);
    await this.notificationFramework.fire({
      kind: NotificationKind.REVIEW_SUBMITTED,
      context: {
        projectId,
        reviewId: review.id,
        reviewDisplayId: review.displayId,
        phase,
      },
    });
    return review;
  }

  /** Eligibility-only assertion (BR-BS6) — reused by the portfolio batch orchestrator. */
  async assertSubmittable(projectId: string, phase: ReviewPhase, actor: AuthUser): Promise<void> {
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    if (!isAdmin && (role === null || role === ProjectRole.REVIEWER)) {
      throw new ForbiddenException('Only Project Team or Green Rater may submit for review');
    }
    const project = await this.projects.findById(projectId);
    if (project.status !== ProjectStatus.REGISTERED) {
      throw new ConflictException('Project must be REGISTERED to submit for review');
    }
    await this.assertPhaseEligible(projectId, phase);
    const attemptedCount = await this.entries.count({ where: { projectId, attempted: true } });
    if (attemptedCount === 0) {
      throw new BadRequestException('Attempt at least one credit before submitting for review');
    }
    const existing = await this.reviews.findOne({ where: { projectId, phase } });
    if (existing && existing.status !== ReviewStatus.RETURNED) {
      throw new ConflictException('A review for this phase is already in progress');
    }
  }

  private async assertPhaseEligible(projectId: string, phase: ReviewPhase): Promise<void> {
    if (phase === ReviewPhase.FINAL) {
      const prelim = await this.reviews.findOne({
        where: { projectId, phase: ReviewPhase.PRELIMINARY },
      });
      if (
        !prelim ||
        prelim.status !== ReviewStatus.RETURNED ||
        (prelim.outcome !== ReviewOutcome.PASSED &&
          prelim.outcome !== ReviewOutcome.PASSED_WITH_ISSUES)
      ) {
        throw new ConflictException('A passed preliminary review is required before FINAL');
      }
    }
    if (phase === ReviewPhase.SUPPLEMENTAL) {
      const final = await this.reviews.findOne({ where: { projectId, phase: ReviewPhase.FINAL } });
      if (
        !final ||
        final.status !== ReviewStatus.RETURNED ||
        final.outcome !== ReviewOutcome.PASSED_WITH_ISSUES
      ) {
        throw new ConflictException('SUPPLEMENTAL requires a returned FINAL passed-with-issues');
      }
    }
  }

  // ── award decisions (BL-2) ─────────────────────────────────────────

  async awardCredit(
    projectId: string,
    reviewId: string,
    creditId: string,
    awardedPoints: number,
    actor: AuthUser,
  ): Promise<ScorecardEntry> {
    await this.assertReviewerOrAdmin(actor, projectId);
    const review = await this.openReview(projectId, reviewId);
    const entry = await this.entries.findOne({ where: { projectId, creditId } });
    if (!entry) throw new NotFoundException('Scorecard entry not found');
    if (awardedPoints < 0 || awardedPoints > entry.verifiedPoints) {
      throw new BadRequestException('awardedPoints must be between 0 and verifiedPoints');
    }

    const before = entry.awardedPoints;
    entry.awardedPoints = awardedPoints;
    entry.version += 1;
    this.auditStamp.stampUpdate(entry, actor.id);
    await this.entries.save(entry);

    await this.markDecided(review, actor.id);
    await this.audit.record({
      entityType: 'ScorecardEntry.awarded',
      entityId: entry.id,
      action: AuditAction.UPDATE,
      before: { awardedPoints: before },
      after: { awardedPoints: awardedPoints },
    });
    return entry;
  }

  async awardAllVerified(
    projectId: string,
    reviewId: string,
    actor: AuthUser,
  ): Promise<{ updatedCount: number }> {
    await this.assertReviewerOrAdmin(actor, projectId);
    const review = await this.openReview(projectId, reviewId);
    const attempted = await this.entries.find({ where: { projectId, attempted: true } });
    let updatedCount = 0;
    for (const entry of attempted) {
      if (entry.awardedPoints !== entry.verifiedPoints) {
        entry.awardedPoints = entry.verifiedPoints;
        entry.version += 1;
        this.auditStamp.stampUpdate(entry, actor.id);
        await this.entries.save(entry);
        updatedCount += 1;
      }
    }
    await this.markDecided(review, actor.id);
    await this.audit.record({
      entityType: 'Review.awardAllVerified',
      entityId: review.id,
      action: AuditAction.UPDATE,
      after: { updatedCount },
    });
    return { updatedCount };
  }

  private async openReview(projectId: string, reviewId: string): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id: reviewId, projectId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status !== ReviewStatus.SUBMITTED && review.status !== ReviewStatus.DECIDED) {
      throw new ConflictException('No open review to record decisions against');
    }
    return review;
  }

  private async markDecided(review: Review, actorUserId: string): Promise<void> {
    if (review.status === ReviewStatus.SUBMITTED) {
      assertReviewTransition(review.status, ReviewStatus.DECIDED);
      review.status = ReviewStatus.DECIDED;
    }
    review.reviewedByUserId = review.reviewedByUserId ?? actorUserId;
    review.decidedAt = new Date();
    review.version += 1;
    await this.reviews.save(review);
  }

  // ── confirm / return (BL-3 / BL-4) ─────────────────────────────────

  async confirm(
    projectId: string,
    reviewId: string,
    dto: ConfirmReviewDto,
    actor: AuthUser,
  ): Promise<Review> {
    await this.assertReviewerOrAdmin(actor, projectId);
    const review = await this.reviews.findOne({ where: { id: reviewId, projectId } });
    if (!review) throw new NotFoundException('Review not found');
    assertReviewTransition(review.status, ReviewStatus.CONFIRMED);

    const project = await this.projects.findById(projectId);
    const computed = await this.report.compute(project, review);

    let outcome = dto.outcome;
    if (!outcome) {
      if (computed.certificationLevel && computed.everyAttemptedFullyAwarded) {
        outcome = ReviewOutcome.PASSED;
      } else if (computed.certificationLevel) {
        outcome = ReviewOutcome.PASSED_WITH_ISSUES;
      } else {
        outcome = ReviewOutcome.DENIED;
      }
    }

    review.status = ReviewStatus.CONFIRMED;
    review.outcome = outcome;
    review.confirmedByUserId = actor.id;
    review.confirmedAt = new Date();
    review.reportMarkdown = computed.markdown;
    review.reportGeneratedAt = new Date();
    review.awardedTotal = computed.awardedTotal;
    review.certificationLevel = computed.certificationLevel;
    review.version += 1;
    this.auditStamp.stampUpdate(review, actor.id);
    const saved = await this.reviews.save(review);

    await this.audit.record({
      entityType: 'Review.confirmed',
      entityId: saved.id,
      action: AuditAction.TRANSITION,
      after: {
        outcome,
        awardedTotal: computed.awardedTotal,
        certificationLevel: computed.certificationLevel,
      },
    });
    return saved;
  }

  async returnReview(projectId: string, reviewId: string, actor: AuthUser): Promise<Review> {
    await this.assertReviewerOrAdmin(actor, projectId);
    const review = await this.reviews.findOne({ where: { id: reviewId, projectId } });
    if (!review) throw new NotFoundException('Review not found');
    assertReviewTransition(review.status, ReviewStatus.RETURNED);

    const saved = await this.dataSource.transaction(async (manager) => {
      review.status = ReviewStatus.RETURNED;
      review.returnedByUserId = actor.id;
      review.returnedAt = new Date();
      review.version += 1;
      this.auditStamp.stampUpdate(review, actor.id);
      const row = await manager.save(review);
      await this.projects.transitionStatus(projectId, ProjectStatus.REGISTERED, actor.id, manager);
      return row;
    });

    await this.audit.record({
      entityType: 'Review.returned',
      entityId: saved.id,
      action: AuditAction.TRANSITION,
      after: { outcome: saved.outcome },
    });
    const project = await this.projects.findById(projectId);
    this.notifyMembers(project.name, 'review-returned', `Review for ${project.name} has been returned.`);
    await this.notificationFramework.fire({
      kind: NotificationKind.REVIEW_RETURNED,
      context: {
        projectId,
        reviewId: saved.id,
        reviewDisplayId: saved.displayId,
        phase: saved.phase,
        outcome: saved.outcome,
      },
    });
    return saved;
  }

  // ── accept / continue (BL-5 / BL-6) ────────────────────────────────

  async accept(projectId: string, actor: AuthUser): Promise<Review> {
    await this.assertTeamOrAdmin(actor, projectId);
    const latest = await this.latestReturned(projectId);
    if (!latest) throw new ConflictException('No returned review to accept');
    if (latest.outcome === ReviewOutcome.DENIED) {
      throw new ConflictException('The review was denied; certification cannot be accepted');
    }
    await this.dataSource.transaction(async (manager) => {
      await this.projects.transitionStatus(projectId, ProjectStatus.CERTIFIED, actor.id, manager);
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (project) {
        project.achievedCertificationLevel = latest.certificationLevel;
        project.version += 1;
        await manager.save(project);
      }
    });
    await this.audit.record({
      entityType: 'Project.certified',
      entityId: projectId,
      action: AuditAction.TRANSITION,
      after: { reviewId: latest.id, certificationLevel: latest.certificationLevel },
    });
    return latest;
  }

  async continueToNextPhase(projectId: string, actor: AuthUser): Promise<{ fromPhase: ReviewPhase }> {
    await this.assertTeamOrAdmin(actor, projectId);
    const latest = await this.latestReturned(projectId);
    if (!latest) throw new ConflictException('No returned review');
    await this.audit.record({
      entityType: 'Project.continueToNextPhase',
      entityId: projectId,
      action: AuditAction.UPDATE,
      after: { fromPhase: latest.phase },
    });
    return { fromPhase: latest.phase };
  }

  private async latestReturned(projectId: string): Promise<Review | null> {
    const rows = await this.reviews.find({
      where: { projectId, status: ReviewStatus.RETURNED },
      order: { submittedAt: 'DESC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  // ── quality score (BL-7) ───────────────────────────────────────────

  async upsertQualityScore(
    projectId: string,
    reviewId: string,
    score: number,
    notes: string | null,
    actor: AuthUser,
  ): Promise<SubmittalQualityScore> {
    await this.assertReviewerOrAdmin(actor, projectId);
    const review = await this.reviews.findOne({ where: { id: reviewId, projectId } });
    if (!review) throw new NotFoundException('Review not found');

    const existing = await this.qualityScores.findOne({ where: { projectId, reviewId } });
    const before = existing ? { score: existing.score, notes: existing.notes } : null;
    const row = existing ?? this.qualityScores.create({ projectId, reviewId, version: 1 });
    row.score = score;
    row.notes = notes;
    row.enteredByUserId = actor.id;
    row.enteredAt = new Date();
    if (existing) {
      row.version += 1;
      this.auditStamp.stampUpdate(row, actor.id);
    } else {
      this.auditStamp.stampCreate(row, actor.id);
    }
    const saved = await this.qualityScores.save(row);

    await this.audit.record({
      entityType: 'SubmittalQualityScore.upserted',
      entityId: saved.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: before ?? undefined,
      after: { score: saved.score, notes: saved.notes },
    });
    return saved;
  }

  // ── reviewer assignment (BL-8) ─────────────────────────────────────

  async assignReviewer(projectId: string, userId: string, actor: AuthUser): Promise<void> {
    if (actor.globalRole !== GlobalRole.ADMIN) {
      throw new ForbiddenException('Only an Admin may assign reviewers');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    await this.membership.addMember(userId, projectId, ProjectRole.REVIEWER, actor.id, actor.id);
    const project = await this.projects.findById(projectId);
    await this.notificationFramework.fire(
      {
        kind: NotificationKind.REVIEWER_ASSIGNED,
        context: {
          projectId,
          displayProjectId: project.gbciDisplayId,
          projectName: project.name,
        },
      },
      { resolvedUsers: { reviewer: { userId: user.id, email: user.email } } },
    );
  }

  // ── auth helpers ───────────────────────────────────────────────────

  private async assertMember(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }

  private async assertReviewerOrAdmin(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (role !== ProjectRole.REVIEWER) {
      throw new ForbiddenException('Only a Reviewer or Admin may perform this action');
    }
  }

  private async assertTeamOrAdmin(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (role !== ProjectRole.PROJECT_TEAM && role !== ProjectRole.GREEN_RATER) {
      throw new ForbiddenException('Only Project Team or Green Rater may perform this action');
    }
  }

  private notifyMembers(projectName: string, kind: string, body: string): void {
    this.notifications.send({
      channel: 'email',
      to: 'project-members@residential.test',
      subject: `[${kind}] ${projectName}`,
      body,
      meta: { kind },
    });
  }
}
