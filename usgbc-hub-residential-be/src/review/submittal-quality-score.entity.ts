import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';

/** Authoritative submittal quality score per review (BR-QS1..BR-QS3). */
@Entity('submittal_quality_scores')
@Unique('uq_qs_project_review', ['projectId', 'reviewId'])
export class SubmittalQualityScore extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  reviewId!: string;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid' })
  enteredByUserId!: string;

  @Column({ type: 'timestamptz' })
  enteredAt!: Date;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
