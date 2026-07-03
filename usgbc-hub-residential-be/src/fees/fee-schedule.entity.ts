import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { MembershipLevel } from '../projects/enums';

/** Hand-curated fee lookup driving the FeeCalculator (BR-F2). */
@Entity('fee_schedules')
@Unique('uq_fee_ratingsystem_membership', ['ratingSystemSlug', 'membershipLevel'])
export class FeeSchedule extends AuditBase {
  @Index()
  @Column({ type: 'varchar', length: 100 })
  ratingSystemSlug!: string;

  @Column({ type: 'enum', enum: MembershipLevel })
  membershipLevel!: MembershipLevel;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'timestamptz' })
  effectiveAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  retiredAt!: Date | null;
}
