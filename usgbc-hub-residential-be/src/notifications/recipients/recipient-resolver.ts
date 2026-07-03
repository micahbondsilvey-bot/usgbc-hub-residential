import { ProjectRole } from '../../auth/enums/role.enum';
import { NotificationKind } from '../enums/notification.enums';

/** Pure recipient fan-out (BR-N3, FL-15). No Nest imports, no I/O. */

export interface NotificationEvent {
  kind: NotificationKind;
  context: Record<string, unknown>;
}

export interface ProjectMember {
  userId: string;
  projectRole: ProjectRole;
  email: string;
}

export interface RecipientResolutionContext {
  projectMembers: Record<string, ProjectMember[]>;
  projectOwnerEmails?: Record<string, string | null>;
  resolvedUsers?: Record<string, { userId: string; email: string }>;
}

export interface RecipientPlan {
  recipients: Array<{ userId: string; email: string | null; eventKey: string }>;
}

function str(context: Record<string, unknown>, key: string): string {
  return String(context[key] ?? '');
}

function teamAndRater(members: ProjectMember[]): ProjectMember[] {
  return members.filter(
    (m) => m.projectRole === ProjectRole.PROJECT_TEAM || m.projectRole === ProjectRole.GREEN_RATER,
  );
}

function dedupeByUser(
  recipients: Array<{ userId: string; email: string | null; eventKey: string }>,
): Array<{ userId: string; email: string | null; eventKey: string }> {
  const seen = new Set<string>();
  const out: Array<{ userId: string; email: string | null; eventKey: string }> = [];
  for (const r of recipients) {
    if (seen.has(r.eventKey)) continue;
    seen.add(r.eventKey);
    out.push(r);
  }
  return out;
}

export function resolveRecipients(
  event: NotificationEvent,
  ctx: RecipientResolutionContext,
): RecipientPlan {
  switch (event.kind) {
    case NotificationKind.INVITATION_SENT: {
      const invitee = ctx.resolvedUsers?.['invitee'];
      if (!invitee) return { recipients: [] };
      const invitationId = str(event.context, 'invitationId');
      return {
        recipients: [
          {
            userId: invitee.userId,
            email: invitee.email,
            eventKey: `invitation:${invitationId}:${invitee.userId}`,
          },
        ],
      };
    }

    case NotificationKind.REGISTRATION_CONFIRMED: {
      const projectId = str(event.context, 'projectId');
      const members = teamAndRater(ctx.projectMembers[projectId] ?? []);
      const recipients = members.map((m) => ({
        userId: m.userId,
        email: m.email,
        eventKey: `registration:${projectId}:${m.userId}`,
      }));
      const owner = ctx.resolvedUsers?.['owner'];
      if (owner) {
        recipients.push({
          userId: owner.userId,
          email: owner.email,
          eventKey: `registration:${projectId}:${owner.userId}`,
        });
      }
      return { recipients: dedupeByUser(recipients) };
    }

    case NotificationKind.REVIEW_SUBMITTED:
    case NotificationKind.REVIEW_RETURNED: {
      const projectId = str(event.context, 'projectId');
      const reviewId = str(event.context, 'reviewId');
      const prefix = event.kind === NotificationKind.REVIEW_SUBMITTED ? 'review-submitted' : 'review-returned';
      const members = teamAndRater(ctx.projectMembers[projectId] ?? []);
      return {
        recipients: dedupeByUser(
          members.map((m) => ({
            userId: m.userId,
            email: m.email,
            eventKey: `${prefix}:${reviewId}:${m.userId}`,
          })),
        ),
      };
    }

    case NotificationKind.PORTFOLIO_BATCH_COMPLETED: {
      const anchorProjectId = str(event.context, 'anchorProjectId');
      const phase = str(event.context, 'phase');
      const second = Math.floor(Date.now() / 1000);
      const members = teamAndRater(ctx.projectMembers[anchorProjectId] ?? []);
      return {
        recipients: dedupeByUser(
          members.map((m) => ({
            userId: m.userId,
            email: m.email,
            eventKey: `portfolio-batch:${anchorProjectId}:${phase}:${second}:${m.userId}`,
          })),
        ),
      };
    }

    case NotificationKind.REVIEWER_ASSIGNED: {
      const projectId = str(event.context, 'projectId');
      const reviewer = ctx.resolvedUsers?.['reviewer'];
      if (!reviewer) return { recipients: [] };
      return {
        recipients: [
          {
            userId: reviewer.userId,
            email: reviewer.email,
            eventKey: `reviewer-assigned:${projectId}:${reviewer.userId}`,
          },
        ],
      };
    }

    default:
      return { recipients: [] };
  }
}
