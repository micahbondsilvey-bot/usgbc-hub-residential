import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { CreditCategory } from './credit-category.entity';

export interface CertificationLevel {
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

/**
 * Top-level rating system container (e.g., LEED v4.1 Residential Single Family).
 * A data-driven lookup table so new rating systems can be added by seed (NFR-2.4).
 */
@Entity('rating_systems')
@Unique('uq_rating_system_version_program', ['version', 'program'])
export class RatingSystem extends AuditBase {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  version!: string;

  @Column({ type: 'varchar', length: 40 })
  program!: string;

  @Column({ type: 'int' })
  totalPointsAvailable!: number;

  @Column({ type: 'jsonb' })
  certificationLevels!: CertificationLevel[];

  @Column({ type: 'timestamptz', nullable: true })
  effectiveAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  retiredAt!: Date | null;

  @OneToMany(() => CreditCategory, (category) => category.ratingSystem)
  categories!: CreditCategory[];
}
