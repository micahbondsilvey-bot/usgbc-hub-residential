import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** One uploaded file in a slot. */
@Entity('submittals')
export class Submittal extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  slotId!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'varchar', length: 260 })
  originalFileName!: string;

  @Column({ type: 'varchar', length: 220 })
  safeFileName!: string;

  @Column({ type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ type: 'uuid' })
  uploadedByUserId!: string;

  @Column({ type: 'timestamptz' })
  uploadedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;
}
