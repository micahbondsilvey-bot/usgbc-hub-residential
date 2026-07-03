import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { RatingSystem } from './rating-system.entity';
import { Credit } from './credit.entity';

/** A grouping of credits within a rating system (e.g., Energy & Atmosphere). */
@Entity('credit_categories')
@Unique('uq_category_ratingsystem_slug', ['ratingSystemId', 'slug'])
export class CreditCategory extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  ratingSystemId!: string;

  @ManyToOne(() => RatingSystem, (rs) => rs.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ratingSystemId' })
  ratingSystem!: RatingSystem;

  @Column({ type: 'varchar', length: 40 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'int' })
  displayOrder!: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  iconRef!: string | null;

  @OneToMany(() => Credit, (credit) => credit.category)
  credits!: Credit[];
}
