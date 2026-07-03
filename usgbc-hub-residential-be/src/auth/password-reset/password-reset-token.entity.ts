import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** One-time, time-bounded password reset token (BR-A3). Cleartext never stored. */
@Entity('password_reset_tokens')
export class PasswordResetToken extends AuditBase {
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
