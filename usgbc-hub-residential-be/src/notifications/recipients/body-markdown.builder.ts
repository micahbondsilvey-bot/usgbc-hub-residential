import { NotificationKind } from '../enums/notification.enums';

/** Pure subject + body + deep-link composition for a notification. No I/O. */

export interface ComposedNotification {
  subject: string;
  bodyMarkdown: string;
  link: string | null;
}

function s(context: Record<string, unknown>, key: string): string {
  return String(context[key] ?? '');
}

export function composeNotification(
  kind: NotificationKind,
  context: Record<string, unknown>,
): ComposedNotification {
  switch (kind) {
    case NotificationKind.INVITATION_SENT:
      return {
        subject: 'You have been invited to a project',
        bodyMarkdown: `You were invited as **${s(context, 'projectRole')}**.`,
        link: `/invitations/accept`,
      };

    case NotificationKind.REGISTRATION_CONFIRMED:
      return {
        subject: `Project registered: ${s(context, 'displayProjectId')}`,
        bodyMarkdown: `Registration confirmed. Invoice **${s(context, 'invoiceDisplayId')}**.`,
        link: `/projects/${s(context, 'projectId')}`,
      };

    case NotificationKind.REVIEW_SUBMITTED:
      return {
        subject: `Submitted for ${s(context, 'phase')} review`,
        bodyMarkdown: `Review **${s(context, 'reviewDisplayId')}** was submitted.`,
        link: `/projects/${s(context, 'projectId')}/review`,
      };

    case NotificationKind.REVIEW_RETURNED:
      return {
        subject: `Review returned: ${s(context, 'reviewDisplayId')}`,
        bodyMarkdown: `Your ${s(context, 'phase')} review was returned — outcome **${s(context, 'outcome')}**.`,
        link: `/projects/${s(context, 'projectId')}/review`,
      };

    case NotificationKind.PORTFOLIO_BATCH_COMPLETED:
      return {
        subject: `Portfolio ${s(context, 'phase')} batch completed`,
        bodyMarkdown: `The portfolio batch submission has completed.`,
        link: `/projects/${s(context, 'anchorProjectId')}/portfolio`,
      };

    case NotificationKind.REVIEWER_ASSIGNED:
      return {
        subject: `You have been assigned as reviewer`,
        bodyMarkdown: `You were assigned to review **${s(context, 'projectName')}** (${s(context, 'displayProjectId')}).`,
        link: `/projects/${s(context, 'projectId')}/review`,
      };

    default:
      return { subject: 'Notification', bodyMarkdown: '', link: null };
  }
}
