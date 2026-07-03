import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { ProjectRole } from '../auth/enums/role.enum';

export enum InvitationState {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

/** Terminal invitation states — no transition permitted out of these (BR-I2). */
export const TERMINAL_INVITATION_STATES: ReadonlySet<InvitationState> = new Set([
  InvitationState.ACCEPTED,
  InvitationState.DECLINED,
  InvitationState.EXPIRED,
  InvitationState.REVOKED,
]);

/**
 * Token-based project invitation (domain-entities.md, US-2.6). At most one
 * PENDING row per (projectId, inviteeEmail); re-invite supersedes the prior one.
 */
@Entity('invitations')
@Index(['projectId', 'inviteeEmail'])
export class Invitation extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 320 })
  inviteeEmail!: string;

  @Column({ type: 'enum', enum: ProjectRole })
  projectRole!: ProjectRole;

  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'enum', enum: InvitationState, default: InvitationState.PENDING })
  state!: InvitationState;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  declinedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid' })
  invitedBy!: string;

  @Column({ type: 'uuid', nullable: true })
  acceptedByUserId!: string | null;
}
