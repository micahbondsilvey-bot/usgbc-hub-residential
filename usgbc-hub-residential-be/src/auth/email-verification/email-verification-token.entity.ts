import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** One-time, time-bounded email verification token (BR-A4). */
@Entity('email_verification_tokens')
export class EmailVerificationToken extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
