import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';

/** A single bulk Excel upload (US-2.4). */
@Entity('bulk_registration_batches')
export class BulkRegistrationBatch extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  uploaderUserId!: string;

  @Column({ type: 'varchar', length: 260 })
  fileName!: string;

  @Column({ type: 'int' })
  fileSizeBytes!: number;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  succeededRows!: number;

  @Column({ type: 'int', default: 0 })
  failedRows!: number;

  @Column({ type: 'timestamptz' })
  uploadedAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  idempotencyHash!: string;
}
