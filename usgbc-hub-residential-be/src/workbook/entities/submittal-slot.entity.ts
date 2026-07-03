import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';

/** A project's instance of a SubmittalSlotDefinition. */
@Entity('submittal_slots')
@Unique('uq_ss_project_slotdef', ['projectId', 'slotDefinitionId'])
export class SubmittalSlot extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'uuid' })
  slotDefinitionId!: string;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
