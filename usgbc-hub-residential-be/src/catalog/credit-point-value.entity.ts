import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { Credit } from './credit.entity';

/** A performance tier for a tiered credit. Absent rows ⇒ credit is fixed-point. */
@Entity('credit_point_values')
@Unique('uq_tier_credit_label', ['creditId', 'tierLabel'])
export class CreditPointValue extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @ManyToOne(() => Credit, (credit) => credit.pointValues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditId' })
  credit!: Credit;

  @Column({ type: 'varchar', length: 120 })
  tierLabel!: string;

  @Column({ type: 'int' })
  points!: number;

  @Column({ type: 'int' })
  displayOrder!: number;
}
