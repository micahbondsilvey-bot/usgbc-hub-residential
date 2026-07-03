import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { CreditCategory } from './credit-category.entity';
import { CreditPointValue } from './credit-point-value.entity';

export type CreditKind = 'prerequisite' | 'credit';

/** A single credit or prerequisite, with lightweight rich metadata (Q2=B). */
@Entity('credits')
@Unique('uq_credit_category_slug', ['categoryId', 'slug'])
export class Credit extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => CreditCategory, (category) => category.credits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category!: CreditCategory;

  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: CreditKind;

  @Column({ type: 'int', nullable: true })
  pointsMin!: number | null;

  @Column({ type: 'int', nullable: true })
  pointsMax!: number | null;

  @Column({ type: 'text', nullable: true })
  intent!: string | null;

  @Column({ type: 'text', nullable: true })
  requirementsSummary!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  referenceGuideUrl!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags!: string[];

  @Column({ type: 'int' })
  displayOrder!: number;

  @OneToMany(() => CreditPointValue, (tier) => tier.credit)
  pointValues!: CreditPointValue[];
}
