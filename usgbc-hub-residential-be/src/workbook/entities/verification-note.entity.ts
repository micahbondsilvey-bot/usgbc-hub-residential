import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../../audit/audit-base.entity';
import { NoteColumn } from '../enums';

/** Three-column verification notes; one row per (projectId, creditId, column). */
@Entity('verification_notes')
@Unique('uq_vn_project_credit_column', ['projectId', 'creditId', 'column'])
export class VerificationNote extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @Column({ type: 'enum', enum: NoteColumn })
  column!: NoteColumn;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'uuid', nullable: true })
  savedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  savedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
