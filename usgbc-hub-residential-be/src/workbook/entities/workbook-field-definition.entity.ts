import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';
import { WorkbookFieldDataType } from '../enums';

/** Defines one Field Verification input for a credit (catalog-level). */
@Entity('workbook_field_definitions')
@Unique('uq_wfd_credit_fieldkey', ['creditId', 'fieldKey'])
export class WorkbookFieldDefinition extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'varchar', length: 120 })
  fieldKey!: string;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  helpText!: string | null;

  @Column({ type: 'varchar', length: 20 })
  dataType!: WorkbookFieldDataType;

  @Column({ type: 'varchar', length: 40, nullable: true })
  unit!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  min!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  max!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  enumOptions!: string[] | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  areaTag!: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  formulaKey!: string | null;

  @Column({ type: 'boolean', default: false })
  required!: boolean;
}
