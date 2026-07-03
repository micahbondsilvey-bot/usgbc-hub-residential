import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { ReviewService } from '../review/review.service';
import { ReviewPhase } from '../review/enums';
import { PortfolioService } from './portfolio.service';
import { PortfolioFeeService } from './portfolio-fee.service';
import { Project } from '../projects/project.entity';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationKind } from '../notifications/enums/notification.enums';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

type SkipReason =
  | 'NO_MEMBERSHIP'
  | 'WRONG_PROJECT_STATUS'
  | 'NO_ATTEMPTED_CREDIT'
  | 'PHASE_ORDERING'
  | 'REVIEW_IN_PROGRESS'
  | 'ANCHOR_FAILED';

type ChildSubmitOutcome =
  | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
  | { projectId: string; displayProjectId: string | null; status: 'SKIPPED_INELIGIBLE'; reason: SkipReason }
  | { projectId: string; displayProjectId: string | null; status: 'FAILED'; error: { code: string; message: string } };

type AnchorOutcome =
  | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
  | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_INELIGIBLE'; reason: SkipReason }
  | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_FAILED'; error: { code: string; message: string } };

export interface BatchSubmitResult {
  anchor: AnchorOutcome;
  children: ChildSubmitOutcome[];
  summary: { submittedCount: number; skippedCount: number; failedCount: number };
}

@Injectable()
export class PortfolioSubmissionOrchestrator {
  constructor(
    private readonly reviews: ReviewService,
    private readonly portfolio: PortfolioService,
    private readonly portfolioFees: PortfolioFeeService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async payAndSubmit(
    anchorId: string,
    phase: ReviewPhase,
    actor: AuthUser,
  ): Promise<BatchSubmitResult> {
    await this.assertAnchorContributor(actor, anchorId);
    const quote = await this.portfolioFees.quote(anchorId, phase);
    if (quote.totals.totalCents === 0) {
      return this.submit(anchorId, phase, actor);
    }
    throw new NotImplementedException(
      'PORTFOLIO_COMBINED_PAYMENT_NOT_IMPLEMENTED — use per-project pay flow then portfolio submit',
    );
  }

  /** BR-BS1..BR-BS8 — anchor-first, cascade on anchor failure, independent children. */
  async submit(anchorId: string, phase: ReviewPhase, actor: AuthUser): Promise<BatchSubmitResult> {
    await this.assertAnchorContributor(actor, anchorId);
    const { anchor, children } = await this.portfolio.resolvePortfolio(anchorId);

    // Anchor pre-flight.
    const anchorEligibility = await this.checkEligible(anchor.id, phase, actor);
    if (anchorEligibility) {
      const result = this.cascadeSkipped(anchor, children, anchorEligibility, null);
      await this.auditBatch(anchorId, phase, result.summary);
      throw new ConflictException({ code: 'ANCHOR_INELIGIBLE', result });
    }

    // Anchor submit.
    let anchorOutcome: AnchorOutcome;
    try {
      const review = await this.reviews.submit(anchor.id, phase, actor);
      anchorOutcome = {
        projectId: anchor.id,
        displayProjectId: anchor.gbciDisplayId,
        status: 'SUBMITTED',
        reviewId: review.id,
        reviewDisplayId: review.displayId,
      };
    } catch (err) {
      const error = this.toError(err);
      const result = this.cascadeSkipped(anchor, children, null, error);
      await this.auditBatch(anchorId, phase, result.summary);
      throw new InternalServerErrorException({ code: 'ANCHOR_FAILED', result });
    }

    // Children submit (independent).
    const childOutcomes: ChildSubmitOutcome[] = [];
    for (const child of children) {
      const skip = await this.checkEligible(child.id, phase, actor);
      if (skip) {
        childOutcomes.push({
          projectId: child.id,
          displayProjectId: child.gbciDisplayId,
          status: 'SKIPPED_INELIGIBLE',
          reason: skip,
        });
      } else {
        try {
          const review = await this.reviews.submit(child.id, phase, actor);
          childOutcomes.push({
            projectId: child.id,
            displayProjectId: child.gbciDisplayId,
            status: 'SUBMITTED',
            reviewId: review.id,
            reviewDisplayId: review.displayId,
          });
        } catch (err) {
          childOutcomes.push({
            projectId: child.id,
            displayProjectId: child.gbciDisplayId,
            status: 'FAILED',
            error: this.toError(err),
          });
        }
      }
      await this.auditChild(child.id, childOutcomes[childOutcomes.length - 1]);
    }

    const result: BatchSubmitResult = {
      anchor: anchorOutcome,
      children: childOutcomes,
      summary: this.summarize(anchorOutcome, childOutcomes),
    };
    await this.auditBatch(anchorId, phase, result.summary);
    await this.notifications.fire({
      kind: NotificationKind.PORTFOLIO_BATCH_COMPLETED,
      context: { anchorProjectId: anchorId, phase, summary: result.summary },
    });
    return result;
  }

  /** Returns a SkipReason if the project is NOT submittable, else null (eligible). */
  private async checkEligible(
    projectId: string,
    phase: ReviewPhase,
    actor: AuthUser,
  ): Promise<SkipReason | null> {
    try {
      await this.reviews.assertSubmittable(projectId, phase, actor);
      return null;
    } catch (err) {
      const mapped = this.mapSubmitErrorToSkip(err);
      // Unknown errors bubble as FAILED (handled at submit time); treat pre-flight-unknown as
      // eligible so the real submit can produce a FAILED outcome with the raw message.
      return mapped;
    }
  }

  private mapSubmitErrorToSkip(err: unknown): SkipReason | null {
    if (err instanceof ForbiddenException) return 'NO_MEMBERSHIP';
    const message = err instanceof HttpException ? this.messageOf(err) : String(err);
    if (message.includes('must be REGISTERED')) return 'WRONG_PROJECT_STATUS';
    if (message.includes('at least one credit')) return 'NO_ATTEMPTED_CREDIT';
    if (message.includes('preliminary review') || message.includes('SUPPLEMENTAL requires')) {
      return 'PHASE_ORDERING';
    }
    if (message.includes('already in progress')) return 'REVIEW_IN_PROGRESS';
    return null; // unknown → let the real submit fail with FAILED
  }

  private cascadeSkipped(
    anchor: Project,
    children: Project[],
    reason: SkipReason | null,
    error: { code: string; message: string } | null,
  ): BatchSubmitResult {
    const anchorOutcome: AnchorOutcome = reason
      ? {
          projectId: anchor.id,
          displayProjectId: anchor.gbciDisplayId,
          status: 'ANCHOR_INELIGIBLE',
          reason,
        }
      : {
          projectId: anchor.id,
          displayProjectId: anchor.gbciDisplayId,
          status: 'ANCHOR_FAILED',
          error: error ?? { code: 'ANCHOR_FAILED', message: 'Anchor submission failed' },
        };
    const childOutcomes: ChildSubmitOutcome[] = children.map((c) => ({
      projectId: c.id,
      displayProjectId: c.gbciDisplayId,
      status: 'SKIPPED_INELIGIBLE',
      reason: 'ANCHOR_FAILED',
    }));
    return {
      anchor: anchorOutcome,
      children: childOutcomes,
      summary: { submittedCount: 0, skippedCount: 1 + children.length, failedCount: 0 },
    };
  }

  private summarize(
    anchor: AnchorOutcome,
    children: ChildSubmitOutcome[],
  ): { submittedCount: number; skippedCount: number; failedCount: number } {
    let submitted = anchor.status === 'SUBMITTED' ? 1 : 0;
    let skipped = 0;
    let failed = 0;
    for (const c of children) {
      if (c.status === 'SUBMITTED') submitted += 1;
      else if (c.status === 'SKIPPED_INELIGIBLE') skipped += 1;
      else failed += 1;
    }
    return { submittedCount: submitted, skippedCount: skipped, failedCount: failed };
  }

  private toError(err: unknown): { code: string; message: string } {
    if (err instanceof HttpException) {
      return { code: String(err.getStatus()), message: this.messageOf(err) };
    }
    return { code: 'CHILD_SUBMIT_FAILED', message: (err as Error)?.message ?? 'Unknown error' };
  }

  private messageOf(err: HttpException): string {
    const response = err.getResponse();
    if (typeof response === 'string') return response;
    const asObj = response as { message?: string | string[] };
    if (Array.isArray(asObj.message)) return asObj.message.join('; ');
    return asObj.message ?? err.message;
  }

  private async assertAnchorContributor(actor: AuthUser, anchorId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, anchorId);
    if (role !== ProjectRole.PROJECT_TEAM && role !== ProjectRole.GREEN_RATER) {
      throw new ForbiddenException('Anchor Project Team or Green Rater membership required');
    }
  }

  private async auditBatch(
    anchorId: string,
    phase: ReviewPhase,
    summary: { submittedCount: number; skippedCount: number; failedCount: number },
  ): Promise<void> {
    await this.audit.record({
      entityType: 'PortfolioBatch.submit',
      entityId: anchorId,
      action: AuditAction.UPDATE,
      after: { phase, summary },
    });
  }

  private async auditChild(childId: string, outcome: ChildSubmitOutcome): Promise<void> {
    await this.audit.record({
      entityType: 'PortfolioBatch.child',
      entityId: childId,
      action: AuditAction.UPDATE,
      after: outcome as unknown as Record<string, unknown>,
    });
  }
}
