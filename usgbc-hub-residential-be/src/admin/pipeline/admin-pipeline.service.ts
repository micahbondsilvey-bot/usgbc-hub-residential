import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { ProjectMembership } from '../../membership/project-membership.entity';
import { ScorecardEntry } from '../../scorecard/scorecard-entry.entity';
import { Review } from '../../review/review.entity';
import { SubmittalQualityScore } from '../../review/submittal-quality-score.entity';
import { User } from '../../users/user.entity';
import { GlobalRole, ProjectRole } from '../../auth/enums/role.enum';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { applyPipelineFilters, PipelineFilterInput } from './pipeline-filter';

interface PipelineRow {
  id: string;
  gbciDisplayId: string | null;
  name: string;
  status: Project['status'];
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;
  createdAt: string;
  attemptedTotal: number;
  awardedTotal: number;
  achievedCertificationLevel: string | null;
  targetCertificationLevel: string | null;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: Review['phase'];
    status: Review['status'];
    outcome: Review['outcome'];
    submittedAt: string;
    returnedAt: string | null;
  } | null;
  latestQualityScore: {
    reviewId: string;
    score: number;
    enteredAt: string;
    enteredByUserId: string;
  } | null;
  assignedReviewer: { userId: string; name: string | null; email: string } | null;
}

@Injectable()
export class AdminPipelineService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMembership) private readonly memberships: Repository<ProjectMembership>,
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(SubmittalQualityScore)
    private readonly qualityScores: Repository<SubmittalQualityScore>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(
    actor: AuthUser,
    filter: PipelineFilterInput,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: PipelineRow[]; nextCursor: string | null; filter: PipelineFilterInput }> {
    if (actor.globalRole !== GlobalRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    const take = Math.min(Math.max(limit, 1), 200);

    const all = await this.projects.find({ order: { createdAt: 'DESC', id: 'DESC' } });
    const rows: PipelineRow[] = [];
    for (const project of all) rows.push(await this.toRow(project));

    const filtered = applyPipelineFilters(rows, filter);

    const startIndex = cursor ? this.indexAfterCursor(filtered, cursor) : 0;
    const page = filtered.slice(startIndex, startIndex + take);
    const hasMore = filtered.length > startIndex + take;
    const nextCursor = hasMore ? this.encodeCursor(page[page.length - 1]) : null;

    return { rows: page, nextCursor, filter };
  }

  private async toRow(project: Project): Promise<PipelineRow> {
    const attempted = await this.entries.find({ where: { projectId: project.id, attempted: true } });
    const attemptedTotal = attempted.reduce((a, e) => a + e.attemptedPoints, 0);
    const awardedTotal = attempted.reduce((a, e) => a + e.awardedPoints, 0);

    const reviewRows = await this.reviews.find({
      where: { projectId: project.id },
      order: { submittedAt: 'DESC' },
      take: 1,
    });
    const latest = reviewRows[0];

    const qsRows = await this.qualityScores.find({
      where: { projectId: project.id },
      order: { enteredAt: 'DESC' },
      take: 1,
    });
    const qs = qsRows[0];

    const reviewerMembership = await this.memberships.findOne({
      where: { projectId: project.id, projectRole: ProjectRole.REVIEWER, revokedAt: IsNull() },
    });
    let assignedReviewer: PipelineRow['assignedReviewer'] = null;
    if (reviewerMembership && reviewerMembership.acceptedAt !== null) {
      const user = await this.users.findOne({ where: { id: reviewerMembership.userId } });
      if (user) assignedReviewer = { userId: user.id, name: user.name, email: user.email };
    }

    return {
      id: project.id,
      gbciDisplayId: project.gbciDisplayId,
      name: project.name,
      status: project.status,
      isPortfolioAnchor: project.isPortfolioAnchor,
      parentAnchorId: project.parentAnchorId,
      createdAt: project.createdAt.toISOString(),
      attemptedTotal,
      awardedTotal,
      achievedCertificationLevel: project.achievedCertificationLevel,
      targetCertificationLevel: project.targetCertificationLevel,
      latestReview: latest
        ? {
            reviewId: latest.id,
            reviewDisplayId: latest.displayId,
            phase: latest.phase,
            status: latest.status,
            outcome: latest.outcome,
            submittedAt: latest.submittedAt.toISOString(),
            returnedAt: latest.returnedAt ? latest.returnedAt.toISOString() : null,
          }
        : null,
      latestQualityScore: qs
        ? {
            reviewId: qs.reviewId,
            score: qs.score,
            enteredAt: qs.enteredAt.toISOString(),
            enteredByUserId: qs.enteredByUserId,
          }
        : null,
      assignedReviewer,
    };
  }

  private indexAfterCursor(rows: PipelineRow[], cursor: string): number {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [createdAt, id] = decoded.split('|');
    const idx = rows.findIndex((r) => r.createdAt === createdAt && r.id === id);
    return idx >= 0 ? idx + 1 : 0;
  }

  private encodeCursor(row: PipelineRow): string {
    return Buffer.from(`${row.createdAt}|${row.id}`).toString('base64');
  }
}
