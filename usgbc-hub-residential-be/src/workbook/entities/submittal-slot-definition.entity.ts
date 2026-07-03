import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** Defines one named upload slot for a credit (catalog-level). */
@Entity('submittal_slot_definitions')
@Unique('uq_ssd_credit_slotkey', ['creditId', 'slotKey'])
export class SubmittalSlotDefinition extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'varchar', length: 120 })
  slotKey!: string;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  requirementNote!: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @Column({ type: 'boolean', default: false })
  multiUpload!: boolean;
}
