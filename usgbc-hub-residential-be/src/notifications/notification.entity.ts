import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { NotificationKind } from './enums/notification.enums';

/** One mock-delivered notification per recipient (BR-N1..BR-N6). */
@Entity('notifications')
@Index('notification_recipient_idx', ['recipientUserId', 'readAt', 'firedAt'])
@Index('notification_kind_idx', ['kind', 'firedAt'])
export class Notification extends AuditBase {
  @Column({ type: 'enum', enum: NotificationKind })
  kind!: NotificationKind;

  @Column({ type: 'uuid' })
  recipientUserId!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  recipientEmail!: string | null;

  @Column({ type: 'text' })
  subject!: string;

  @Column({ type: 'text' })
  bodyMarkdown!: string;

  @Column({ type: 'jsonb' })
  context!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  link!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz' })
  firedAt!: Date;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
