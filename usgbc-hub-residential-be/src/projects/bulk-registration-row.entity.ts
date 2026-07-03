import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { BulkRowStatus } from './enums';

/**
 * Per-row outcome of a bulk batch (BR-B3). The partial unique index
 * `(uploaderUserId, externalRowId) WHERE status='CREATED'` enforces idempotency:
 * at most one CREATED row per (uploader, externalRowId), while FAILED rows may
 * be retained across retry batches.
 */
@Entity('bulk_registration_rows')
@Index('bulk_row_idem_unique', ['uploaderUserId', 'externalRowId'], {
  unique: true,
  where: `status = 'CREATED'`,
})
export class BulkRegistrationRow extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  batchId!: string;

  @Column({ type: 'uuid' })
  uploaderUserId!: string;

  @Column({ type: 'varchar', length: 200 })
  externalRowId!: string;

  @Column({ type: 'enum', enum: BulkRowStatus, default: BulkRowStatus.PENDING })
  status!: BulkRowStatus;

  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb' })
  rawRow!: Record<string, unknown>;
}
