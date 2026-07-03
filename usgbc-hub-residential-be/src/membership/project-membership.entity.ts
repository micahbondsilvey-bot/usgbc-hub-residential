import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { ProjectRole } from '../auth/enums/role.enum';

/**
 * A user's single role on a specific project (domain-entities.md).
 * Unique on (userId, projectId) — at most one role per (user, project) (BR-Z1/Q1=X).
 * `projectId` FK targets the Project entity defined in Unit 3 (forward-declared).
 */
@Entity('project_memberships')
@Unique('uq_membership_user_project', ['userId', 'projectId'])
export class ProjectMembership extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'enum', enum: ProjectRole })
  projectRole!: ProjectRole;

  @Column({ type: 'uuid', nullable: true })
  invitedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
