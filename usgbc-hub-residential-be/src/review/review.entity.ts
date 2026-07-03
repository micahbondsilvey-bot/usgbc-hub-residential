import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { ReviewOutcome, ReviewPhase, ReviewStatus } from './enums';

/** One phase's review on a project (BR-RW1..BR-RW8). */
@Entity('reviews')
@Unique('uq_review_project_phase', ['projectId', 'phase'])
export class Review extends AuditBase {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  displayId!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'enum', enum: ReviewPhase })
  phase!: ReviewPhase;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.SUBMITTED })
  status!: ReviewStatus;

  @Column({ type: 'enum', enum: ReviewOutcome, nullable: true })
  outcome!: ReviewOutcome | null;

  @Column({ type: 'uuid' })
  submittedByUserId!: string;

  @Column({ type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  confirmedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  returnedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  returnedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reportMarkdown!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reportGeneratedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  awardedTotal!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  certificationLevel!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
