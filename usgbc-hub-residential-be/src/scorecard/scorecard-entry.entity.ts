import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';

/**
 * Per-project, per-credit point entry — the single source of truth for a
 * project's scorecard state. Point columns are independent integers (Q4=A);
 * the Awarded ≤ Verified ≤ Attempted relationship is a soft expectation only.
 */
@Entity('scorecard_entries')
@Unique('uq_scorecard_project_credit', ['projectId', 'creditId'])
export class ScorecardEntry extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'boolean', default: false })
  attempted!: boolean;

  @Column({ type: 'int', default: 0 })
  attemptedPoints!: number;

  @Column({ type: 'int', default: 0 })
  verifiedPoints!: number;

  @Column({ type: 'int', default: 0 })
  awardedPoints!: number;

  @Column({ type: 'uuid', nullable: true })
  selectedPointValueId!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
