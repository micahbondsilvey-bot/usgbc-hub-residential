import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationKind } from './enums/notification.enums';
import {
  NotificationEvent,
  ProjectMember,
  RecipientResolutionContext,
  resolveRecipients,
} from './recipients/recipient-resolver';
import { composeNotification } from './recipients/body-markdown.builder';
import { MembershipService } from '../membership/membership.service';
import { UsersService } from '../users/users.service';
import { NotificationGateway } from '../common/notifications-stub/notification.gateway';

export interface FireOptions {
  resolvedUsers?: Record<string, { userId: string; email: string }>;
  ownerEmail?: string;
}

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  subject: string;
  bodyMarkdown: string;
  context: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  firedAt: string;
  version: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly membership: MembershipService,
    private readonly users: UsersService,
    private readonly gateway: NotificationGateway,
  ) {}

  /** BR-N1/BR-N3/BR-N4 — resolve recipients, persist per-recipient rows, fire the legacy mock. */
  async fire(event: NotificationEvent, opts: FireOptions = {}): Promise<void> {
    try {
      const ctx = await this.resolveContext(event, opts);
      const plan = resolveRecipients(event, ctx);

      for (const recipient of plan.recipients) {
        const composed = composeNotification(event.kind, event.context);
        const row = this.repo.create({
          kind: event.kind,
          recipientUserId: recipient.userId,
          recipientEmail: recipient.email,
          subject: composed.subject,
          bodyMarkdown: composed.bodyMarkdown,
          context: event.context,
          link: composed.link,
          readAt: null,
          firedAt: new Date(),
          version: 1,
        });
        await this.repo.save(row);
        this.gateway.send({
          channel: 'email',
          to: recipient.email ?? 'unknown@residential.test',
          subject: composed.subject,
          body: composed.bodyMarkdown,
          meta: { kind: event.kind },
        });
      }

      if (plan.recipients.length === 0) {
        // No resolvable recipient — keep the legacy console-mock visibility.
        const composed = composeNotification(event.kind, event.context);
        this.gateway.send({
          channel: 'email',
          to: opts.ownerEmail ?? 'unknown@residential.test',
          subject: composed.subject,
          body: composed.bodyMarkdown,
          meta: { kind: event.kind },
        });
      }
    } catch (err) {
      // Notifications are best-effort (U1 Q4=A) — never break the originating flow.
      this.logger.warn(`Notification fire failed for ${event.kind}: ${(err as Error).message}`);
    }
  }

  private async resolveContext(
    event: NotificationEvent,
    opts: FireOptions,
  ): Promise<RecipientResolutionContext> {
    const projectMembers: Record<string, ProjectMember[]> = {};
    const projectId =
      (event.context['projectId'] as string | undefined) ??
      (event.context['anchorProjectId'] as string | undefined);
    if (projectId) {
      const members = await this.membership.listMembers(projectId);
      projectMembers[projectId] = members.map((m) => ({
        userId: m.userId,
        projectRole: m.projectRole,
        email: m.email,
      }));
    }

    const resolvedUsers = { ...(opts.resolvedUsers ?? {}) };
    if (event.kind === NotificationKind.REGISTRATION_CONFIRMED && opts.ownerEmail) {
      const owner = await this.users.findByEmail(opts.ownerEmail);
      if (owner) resolvedUsers['owner'] = { userId: owner.id, email: owner.email };
    }

    return { projectMembers, resolvedUsers };
  }

  async listForRecipient(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: NotificationDto[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.recipientUserId = :userId', { userId })
      .orderBy('n.firedAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(take + 1);

    const decoded = this.decodeCursor(cursor);
    if (decoded) {
      qb.andWhere('(n.firedAt, n.id) < (:firedAt, :id)', {
        firedAt: decoded.firedAt,
        id: decoded.id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);
    const nextCursor = hasMore ? this.encodeCursor(page[page.length - 1]) : null;
    return { rows: page.map((r) => this.toDto(r)), nextCursor };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { recipientUserId: userId, readAt: IsNull() } });
  }

  async markRead(id: string, userId: string): Promise<NotificationDto> {
    const row = await this.repo.findOne({ where: { id, recipientUserId: userId } });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.readAt === null) {
      row.readAt = new Date();
      row.version += 1;
      await this.repo.save(row);
    }
    return this.toDto(row);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()', version: () => 'version + 1' })
      .where('recipientUserId = :userId AND readAt IS NULL', { userId })
      .execute();
  }

  private toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      kind: n.kind,
      subject: n.subject,
      bodyMarkdown: n.bodyMarkdown,
      context: n.context,
      link: n.link,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      firedAt: n.firedAt.toISOString(),
      version: n.version,
    };
  }

  private encodeCursor(n: Notification): string {
    return Buffer.from(`${n.firedAt.toISOString()}|${n.id}`).toString('base64');
  }

  private decodeCursor(cursor?: string): { firedAt: string; id: string } | null {
    if (!cursor) return null;
    try {
      const [firedAt, id] = Buffer.from(cursor, 'base64').toString('utf-8').split('|');
      if (!firedAt || !id) return null;
      return { firedAt, id };
    } catch {
      return null;
    }
  }
}
