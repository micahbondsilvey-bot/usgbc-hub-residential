import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  TRANSITION = 'TRANSITION',
}

/**
 * Append-only change log (BR-X3). Immutable at the application layer — there is
 * no API to update or delete rows. Loosely coupled by (entityType, entityId).
 */
@Entity('audit_log')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  entityType!: string;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at!: Date;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;
}
