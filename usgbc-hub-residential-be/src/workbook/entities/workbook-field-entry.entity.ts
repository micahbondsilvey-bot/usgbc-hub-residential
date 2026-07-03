import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** A project's value for one WorkbookFieldDefinition (instance-level). */
@Entity('workbook_field_entries')
@Unique('uq_wfe_project_fielddef', ['projectId', 'fieldDefinitionId'])
export class WorkbookFieldEntry extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'uuid' })
  fieldDefinitionId!: string;

  @Column({ type: 'text', nullable: true })
  valueText!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  valueNumeric!: string | null;

  @Column({ type: 'boolean', nullable: true })
  valueBoolean!: boolean | null;

  @Column({ type: 'date', nullable: true })
  valueDate!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  valueEnum!: string | null;

  @Column({ type: 'boolean', default: false })
  derived!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
