import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/enums';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Review } from '../review/review.entity';
import { StateLockService } from '../scorecard/state-lock.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { assertHierarchy, HierarchyCandidate } from './state-machine/hierarchy.invariant';

export interface ProjectSummary {
  id: string;
  gbciDisplayId: string | null;
  name: string;
  status: ProjectStatus;
  achievedCertificationLevel: string | null;
  targetCertificationLevel: string | null;
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;
  attemptedTotal: number;
  awardedTotal: number;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: string;
    status: string;
    outcome: string | null;
    submittedAt: string;
    returnedAt: string | null;
  } | null;
}

export interface PortfolioDashboard {
  anchor: ProjectSummary;
  children: ProjectSummary[];
  rollup: {
    totalChildren: number;
    byStatus: Record<string, number>;
    byCertificationLevel: Record<string, number>;
    attemptedTotal: number;
    awardedTotal: number;
  };
}

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly stateLock: StateLockService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  /** BR-PA1/BR-PA2/BR-PA3 — toggle the anchor flag. */
  async toggleAnchor(
    projectId: string,
    isAnchor: boolean,
    actor: AuthUser,
  ): Promise<Project> {
    await this.stateLock.assertWritable(projectId, {
      userId: actor.id,
      globalRole: actor.globalRole,
    });
    await this.assertContributor(actor, projectId);
    const project = await this.getProject(projectId);
    if (project.isPortfolioAnchor === isAnchor) return project; // idempotent

    if (!isAnchor) {
      await this.assertCanUnanchor(projectId);
    } else if (project.parentAnchorId !== null) {
      throw new ConflictException('ANCHOR_HAS_PARENT');
    }

    const before = { isPortfolioAnchor: project.isPortfolioAnchor };
    project.isPortfolioAnchor = isAnchor;
    project.version += 1;
    this.auditStamp.stampUpdate(project, actor.id);
    const saved = await this.projects.save(project);
    await this.audit.record({
      entityType: 'Project.anchor',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      before,
      after: { isPortfolioAnchor: isAnchor },
    });
    return saved;
  }

  /** BR-PA5/BR-PA6 — attach or detach a child to/from an anchor. */
  async setParentAnchor(
    childId: string,
    parentAnchorId: string | null,
    actor: AuthUser,
  ): Promise<Project> {
    await this.stateLock.assertWritable(childId, {
      userId: actor.id,
      globalRole: actor.globalRole,
    });
    await this.assertContributor(actor, childId);
    const child = await this.getProject(childId);
    const before = { parentAnchorId: child.parentAnchorId };

    if (parentAnchorId === null) {
      child.parentAnchorId = null;
    } else {
      const candidate = await this.getProject(parentAnchorId);
      try {
        assertHierarchy(this.toCandidate(child), this.toCandidate(candidate));
      } catch (err) {
        throw new ConflictException((err as Error).message);
      }
      child.parentAnchorId = candidate.id;
    }

    child.version += 1;
    this.auditStamp.stampUpdate(child, actor.id);
    const saved = await this.projects.save(child);
    await this.audit.record({
      entityType: 'Project.parentAnchor',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      before,
      after: { parentAnchorId: saved.parentAnchorId },
    });
    return saved;
  }

  /** BR-PA3 — reject un-anchor while children remain. */
  async assertCanUnanchor(anchorId: string): Promise<void> {
    const childCount = await this.projects.count({ where: { parentAnchorId: anchorId } });
    if (childCount > 0) {
      throw new ConflictException('ANCHOR_HAS_CHILDREN');
    }
  }

  /** US-5.2 — build the portfolio dashboard. */
  async buildDashboard(anchorId: string, actor: AuthUser): Promise<PortfolioDashboard> {
    await this.assertMember(actor, anchorId);
    const anchor = await this.getProject(anchorId);
    if (!anchor.isPortfolioAnchor) throw new ConflictException('NOT_AN_ANCHOR');

    const children = await this.projects.find({ where: { parentAnchorId: anchorId } });
    children.sort((a, b) => this.compareDisplayId(a.gbciDisplayId, b.gbciDisplayId));

    const anchorSummary = await this.toSummary(anchor);
    const childSummaries: ProjectSummary[] = [];
    for (const child of children) childSummaries.push(await this.toSummary(child));

    const byStatus: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    let attemptedTotal = 0;
    let awardedTotal = 0;
    for (const c of childSummaries) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      const level = c.achievedCertificationLevel ?? 'NONE';
      byLevel[level] = (byLevel[level] ?? 0) + 1;
      attemptedTotal += c.attemptedTotal;
      awardedTotal += c.awardedTotal;
    }

    return {
      anchor: anchorSummary,
      children: childSummaries,
      rollup: {
        totalChildren: childSummaries.length,
        byStatus,
        byCertificationLevel: byLevel,
        attemptedTotal,
        awardedTotal,
      },
    };
  }

  /** Anchor + children lookup used by the fee + submission services. */
  async resolvePortfolio(anchorId: string): Promise<{ anchor: Project; children: Project[] }> {
    const anchor = await this.getProject(anchorId);
    if (!anchor.isPortfolioAnchor) throw new ConflictException('NOT_AN_ANCHOR');
    const children = await this.projects.find({ where: { parentAnchorId: anchorId } });
    children.sort((a, b) => this.compareDisplayId(a.gbciDisplayId, b.gbciDisplayId));
    return { anchor, children };
  }

  private async toSummary(project: Project): Promise<ProjectSummary> {
    const attempted = await this.entries.find({
      where: { projectId: project.id, attempted: true },
    });
    const attemptedTotal = attempted.reduce((acc, e) => acc + e.attemptedPoints, 0);
    const awardedTotal = attempted.reduce((acc, e) => acc + e.awardedPoints, 0);

    const reviewRows = await this.reviews.find({
      where: { projectId: project.id },
      order: { submittedAt: 'DESC' },
      take: 1,
    });
    const latest = reviewRows[0];

    return {
      id: project.id,
      gbciDisplayId: project.gbciDisplayId,
      name: project.name,
      status: project.status,
      achievedCertificationLevel: project.achievedCertificationLevel,
      targetCertificationLevel: project.targetCertificationLevel,
      isPortfolioAnchor: project.isPortfolioAnchor,
      parentAnchorId: project.parentAnchorId,
      attemptedTotal,
      awardedTotal,
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
    };
  }

  private toCandidate(project: Project): HierarchyCandidate {
    return {
      id: project.id,
      isPortfolioAnchor: project.isPortfolioAnchor,
      parentAnchorId: project.parentAnchorId,
    };
  }

  private compareDisplayId(a: string | null, b: string | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1; // NULLs last
    if (b === null) return -1;
    return a.localeCompare(b);
  }

  private async getProject(id: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertContributor(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (role !== ProjectRole.PROJECT_TEAM && role !== ProjectRole.GREEN_RATER) {
      throw new ForbiddenException('Only Project Team or Green Rater may manage the portfolio');
    }
  }

  private async assertMember(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }
}
