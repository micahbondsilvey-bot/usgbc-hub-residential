import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, EntityManager, Repository } from 'typeorm';
import { Project } from './project.entity';
import { ProjectStatus } from './enums';
import { isAllowedTransition } from './status-transition';
import { StateLockService } from '../scorecard/state-lock.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { GlobalRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectFieldsDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    private readonly stateLock: StateLockService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
  ) {}

  async findById(id: string): Promise<Project> {
    const project = await this.repo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /** Status transition with the state machine + audit (used by Unit 5 review flows). */
  async transitionStatus(
    projectId: string,
    to: ProjectStatus,
    actorUserId: string | null,
    manager?: EntityManager,
  ): Promise<Project> {
    const repo = manager ? manager.getRepository(Project) : this.repo;
    const project = await repo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.status === to) return project;
    if (!isAllowedTransition(project.status, to)) {
      throw new ConflictException(`Illegal status transition: ${project.status} → ${to}`);
    }
    const from = project.status;
    project.status = to;
    project.version += 1;
    if (actorUserId) project.updatedBy = actorUserId;
    const saved = await repo.save(project);
    await this.audit.record({
      entityType: 'Project.status',
      entityId: saved.id,
      action: AuditAction.TRANSITION,
      before: { status: from },
      after: { status: to },
      actorUserId,
    });
    return saved;
  }

  /** BR-API1 — projects the caller can see (their memberships, or all for Admin). */
  async listAccessible(actor: AuthUser): Promise<Project[]> {
    if (actor.globalRole === GlobalRole.ADMIN) {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const projectIds = await this.membership.listProjectIdsForUser(actor.id);
    if (projectIds.length === 0) return [];
    return this.repo.find({ where: { id: In(projectIds) }, order: { createdAt: 'DESC' } });
  }

  /** Validate + normalize address/geo fields (BR-P4). */
  applyFields(project: Project, fields: ProjectFieldsDto): void {
    if (fields.name !== undefined) project.name = fields.name;
    if (fields.ratingSystemId !== undefined) project.ratingSystemId = fields.ratingSystemId;
    if (fields.membershipLevel !== undefined) project.membershipLevel = fields.membershipLevel;
    if (fields.buildingType !== undefined) project.buildingType = fields.buildingType;
    if (fields.numberOfUnits !== undefined) project.numberOfUnits = fields.numberOfUnits;
    if (fields.grossArea !== undefined) project.grossArea = fields.grossArea;
    if (fields.targetCertificationLevel !== undefined) {
      project.targetCertificationLevel = fields.targetCertificationLevel;
    }
    if (fields.ownerName !== undefined) project.ownerName = fields.ownerName;
    if (fields.ownerEmail !== undefined) project.ownerEmail = fields.ownerEmail;
    if (fields.ownerPhone !== undefined) project.ownerPhone = fields.ownerPhone;
    if (fields.ownerOrganization !== undefined) project.ownerOrganization = fields.ownerOrganization;
    if (fields.addressLine1 !== undefined) project.addressLine1 = fields.addressLine1;
    if (fields.addressLine2 !== undefined) project.addressLine2 = fields.addressLine2;
    if (fields.city !== undefined) project.city = fields.city;
    if (fields.region !== undefined) project.region = fields.region;
    if (fields.postalCode !== undefined) project.postalCode = fields.postalCode;
    if (fields.country !== undefined) project.country = this.validateCountry(fields.country);
    if (fields.latitude !== undefined) project.latitude = this.validateLat(fields.latitude);
    if (fields.longitude !== undefined) project.longitude = this.validateLng(fields.longitude);
  }

  /** BR-P2 — assert all fields required to register are present. */
  assertRegisterReadiness(project: Project): void {
    const missing: string[] = [];
    const required: Array<[keyof Project, unknown]> = [
      ['name', project.name],
      ['ratingSystemId', project.ratingSystemId],
      ['membershipLevel', project.membershipLevel],
      ['buildingType', project.buildingType],
      ['numberOfUnits', project.numberOfUnits],
      ['grossArea', project.grossArea],
      ['ownerName', project.ownerName],
      ['ownerEmail', project.ownerEmail],
      ['addressLine1', project.addressLine1],
      ['city', project.city],
      ['region', project.region],
      ['postalCode', project.postalCode],
      ['country', project.country],
    ];
    for (const [field, value] of required) {
      if (value === null || value === undefined || value === '') missing.push(String(field));
    }
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Missing required fields', fields: missing });
    }
  }

  /** BL-2 — post-registration / draft edits (fee fields excluded from the DTO). */
  async patch(projectId: string, dto: UpdateProjectDto, actor: AuthUser): Promise<Project> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const project = await this.findById(projectId);
    await this.assertActiveMemberOrAdmin(actor, projectId);

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    this.applyFields(project, dto as ProjectFieldsDto);
    // Track a lightweight diff for the audit row.
    for (const key of Object.keys(dto) as Array<keyof UpdateProjectDto>) {
      after[key] = (dto as Record<string, unknown>)[key];
    }

    project.version += 1;
    const saved = await this.repo.save(project);
    await this.audit.record({
      entityType: 'Project.updated',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      before,
      after,
    });
    return saved;
  }

  /** BL-3 — withdraw (Project Team or Admin only). */
  async withdraw(projectId: string, note: string | undefined, actor: AuthUser): Promise<Project> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const project = await this.findById(projectId);
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    if (!isAdmin && role !== 'PROJECT_TEAM') {
      throw new ForbiddenException('Only Project Team or Admin may withdraw a project');
    }
    if (!isAllowedTransition(project.status, ProjectStatus.WITHDRAWN)) {
      throw new ConflictException(`Cannot withdraw a project in status ${project.status}`);
    }
    const from = project.status;
    project.status = ProjectStatus.WITHDRAWN;
    project.version += 1;
    const saved = await this.repo.save(project);
    await this.audit.record({
      entityType: 'Project.status',
      entityId: saved.id,
      action: AuditAction.TRANSITION,
      before: { status: from },
      after: { status: ProjectStatus.WITHDRAWN },
      reason: note ?? null,
    });
    return saved;
  }

  private async assertActiveMemberOrAdmin(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }

  private validateCountry(country: string): string {
    const code = (country ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new BadRequestException('country must be an ISO-3166-1 alpha-2 code');
    }
    return code;
  }

  private validateLat(lat: number): string {
    if (lat < -90 || lat > 90) throw new BadRequestException('latitude out of range');
    return lat.toString();
  }

  private validateLng(lng: number): string {
    if (lng < -180 || lng > 180) throw new BadRequestException('longitude out of range');
    return lng.toString();
  }
}
