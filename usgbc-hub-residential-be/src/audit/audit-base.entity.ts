import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Shared audit columns for every domain entity (US-11.3, Q5=A, Q6=A).
 * `createdAt`/`updatedAt` are managed by TypeORM; `createdBy`/`updatedBy`
 * carry the actor's User UUID (BR-X2) and are stamped by the audit subscriber
 * (HTTP path) or the AuditStampHelper (system path). These fields are never
 * settable via the API (BR-X1).
 *
 * Invariants (PBT): updatedAt >= createdAt; createdAt/createdBy immutable.
 */
export abstract class AuditBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
