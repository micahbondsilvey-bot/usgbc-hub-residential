import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProjectMembership } from './project-membership.entity';
import { ProjectRole } from '../auth/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import { MemberDto } from './dto/invitation.dto';

/**
 * Project membership queries and mutations (BR-Z2/BR-Z4). A membership is
 * "active" when acceptedAt IS NOT NULL AND revokedAt IS NULL.
 */
@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(ProjectMembership)
    private readonly repo: Repository<ProjectMembership>,
    private readonly users: UsersService,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  /** Resolve a user's active project role, or null if none (BR-Z4). */
  async resolveActiveRole(userId: string, projectId: string): Promise<ProjectRole | null> {
    const membership = await this.repo.findOne({
      where: { userId, projectId, revokedAt: IsNull() },
    });
    if (!membership || membership.acceptedAt === null) return null;
    return membership.projectRole;
  }

  async findMembership(userId: string, projectId: string): Promise<ProjectMembership | null> {
    return this.repo.findOne({ where: { userId, projectId } });
  }

  /** Active project ids for a user (for "my projects" listing). */
  async listProjectIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { userId, revokedAt: IsNull() } });
    return rows.filter((m) => m.acceptedAt !== null).map((m) => m.projectId);
  }

  async listMembers(projectId: string): Promise<MemberDto[]> {
    const memberships = await this.repo.find({
      where: { projectId, revokedAt: IsNull() },
    });
    const active = memberships.filter((m) => m.acceptedAt !== null);
    const members: MemberDto[] = [];
    for (const m of active) {
      const user = await this.users.findById(m.userId);
      members.push({
        userId: m.userId,
        email: user?.email ?? '(unknown)',
        name: user?.name ?? null,
        projectRole: m.projectRole,
        acceptedAt: m.acceptedAt,
      });
    }
    return members;
  }

  /**
   * Create (or return existing) active membership for accept flow (BR-I3).
   * Enforces the (user, project) uniqueness: if a membership exists with a
   * different role, acceptance is rejected.
   */
  async createActiveMembership(
    userId: string,
    projectId: string,
    role: ProjectRole,
    invitedBy: string | null,
    acceptedAt: Date,
  ): Promise<ProjectMembership> {
    const existing = await this.findMembership(userId, projectId);
    if (existing && existing.revokedAt === null) {
      if (existing.projectRole === role) return existing; // idempotent no-op
      throw new ConflictException(
        'User already has a different role on this project; revoke it before accepting.',
      );
    }
    if (existing && existing.revokedAt !== null) {
      // Reactivate a previously revoked membership under the invited role.
      existing.projectRole = role;
      existing.revokedAt = null;
      existing.acceptedAt = acceptedAt;
      existing.invitedBy = invitedBy;
      return this.repo.save(existing);
    }
    const membership = this.repo.create({
      userId,
      projectId,
      projectRole: role,
      invitedBy,
      acceptedAt,
      revokedAt: null,
    });
    return this.repo.save(membership);
  }

  /** Admin-only membership revoke (BR-Z3). */
  async revokeMembership(userId: string, projectId: string): Promise<void> {
    const membership = await this.findMembership(userId, projectId);
    if (!membership || membership.revokedAt !== null) {
      throw new NotFoundException('Active membership not found');
    }
    membership.revokedAt = new Date();
    await this.repo.save(membership);
  }

  /**
   * Directly add an active member (Admin/system path, e.g., demo seed).
   * Idempotent: if a same-role active membership exists it is returned; if a
   * different active role exists it is left untouched and returned (BL-8 step 2).
   */
  async addMember(
    userId: string,
    projectId: string,
    role: ProjectRole,
    invitedBy: string | null = null,
    actorUserId: string | null = null,
  ): Promise<ProjectMembership> {
    const existing = await this.findMembership(userId, projectId);
    if (existing && existing.revokedAt === null) {
      return existing;
    }
    if (existing && existing.revokedAt !== null) {
      existing.projectRole = role;
      existing.revokedAt = null;
      existing.acceptedAt = new Date();
      existing.invitedBy = invitedBy;
      this.auditStamp.stampUpdate(existing, actorUserId);
      return this.repo.save(existing);
    }
    const membership = this.repo.create({
      userId,
      projectId,
      projectRole: role,
      invitedBy,
      acceptedAt: new Date(),
      revokedAt: null,
    });
    this.auditStamp.stampCreate(membership, actorUserId);
    return this.repo.save(membership);
  }
}
