import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Project } from './project.entity';
import { ProjectMembership } from '../membership/project-membership.entity';
import { ProjectStatus } from './enums';
import { ProjectsService } from './projects.service';
import { AgreementService } from './agreement.service';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { ProjectNumberGenerator } from './project-number.generator';
import { FeesService } from '../fees/fees.service';
import { CatalogService } from '../catalog/catalog.service';
import { ScorecardService } from '../scorecard/scorecard.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { NotificationGateway } from '../common/notifications-stub/notification.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationKind } from '../notifications/enums/notification.enums';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { PaymentChoice } from './enums';

export interface RegistrationResult {
  project: Project;
  invoice: Invoice;
}

/** RegistrationOrchestrator (BL-1). Steps 1–6 are transactional; email + scorecard run post-commit. */
@Injectable()
export class RegistrationOrchestrator {
  private readonly logger = new Logger(RegistrationOrchestrator.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly projects: ProjectsService,
    private readonly agreements: AgreementService,
    private readonly invoices: InvoiceService,
    private readonly projectNumbers: ProjectNumberGenerator,
    private readonly fees: FeesService,
    private readonly catalog: CatalogService,
    private readonly scorecard: ScorecardService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationGateway,
    private readonly notificationFramework: NotificationsService,
  ) {}

  /** Create a DRAFT project (mode='draft') with an auto PROJECT_TEAM membership. */
  async createDraft(dto: CreateProjectDto, actor: AuthUser): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = manager.create(Project, { status: ProjectStatus.DRAFT });
      this.projects.applyFields(project, dto);
      project.createdBy = actor.id;
      project.updatedBy = actor.id;
      const saved = await manager.save(project);
      await this.ensureMembership(manager, saved.id, actor);
      return saved;
    });
  }

  /** Full registration (mode='register'). */
  async register(dto: CreateProjectDto, actor: AuthUser): Promise<RegistrationResult> {
    // Bulk rows carry a rating-system slug; resolve it to an id up front.
    if (!dto.ratingSystemId && dto.ratingSystemSlug) {
      const rs = await this.catalog.getRatingSystem(dto.ratingSystemSlug);
      dto.ratingSystemId = rs.id;
    }
    const paymentChoice = dto.paymentChoice ?? PaymentChoice.PAY_LATER;
    const user = await this.users.findById(actor.id);
    const signedByName = user?.name ?? actor.email;

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Resolve or create the draft.
      const project = await this.resolveOrCreateDraft(manager, dto, actor);

      // 2. Readiness gate.
      this.projects.assertRegisterReadiness(project);

      // Idempotent retry short-circuit (BR-N3).
      if (project.gbciDisplayId) {
        const existingInvoice = await manager.findOne(Invoice, {
          where: { projectId: project.id },
        });
        if (existingInvoice) return { project, invoice: existingInvoice };
      }

      // 3. Agreement (name snapshot).
      await this.agreements.signWithinTransaction(manager, {
        projectId: project.id,
        signedByUserId: actor.id,
        signedByName,
        agreementVersion: dto.acceptedAgreementVersion,
      });

      // 4. Fee quote.
      const ratingSystem = await this.catalog.getRatingSystem(project.ratingSystemId);
      const quote = await this.fees.quote(ratingSystem.slug, project.membershipLevel);
      if (quote.warnings.length > 0) {
        throw new ConflictException('Fee schedule unavailable — contact an administrator');
      }

      // 5. Invoice.
      const invoice = await this.invoices.generate(manager, {
        projectId: project.id,
        quote,
        paymentChoice,
        actorUserId: actor.id,
      });

      // 6. Project number + status.
      if (!project.gbciDisplayId) {
        project.gbciDisplayId = await this.projectNumbers.allocate(manager);
      }
      project.status = ProjectStatus.REGISTERED;
      project.registeredAt = new Date();
      project.registeredByUserId = actor.id;
      project.version += 1;
      project.updatedBy = actor.id;
      const savedProject = await manager.save(project);

      return { project: savedProject, invoice };
    });

    // Post-commit: scorecard init (best-effort), email (best-effort), audit.
    await this.safelyInitScorecard(result.project, actor.id);
    this.sendConfirmationEmail(result, actor);
    await this.notificationFramework.fire(
      {
        kind: NotificationKind.REGISTRATION_CONFIRMED,
        context: {
          projectId: result.project.id,
          displayProjectId: result.project.gbciDisplayId,
          invoiceDisplayId: result.invoice.displayId,
          totalCents: result.invoice.totalCents,
        },
      },
      { ownerEmail: result.project.ownerEmail ?? undefined },
    );
    await this.recordAuditTrail(result);

    return result;
  }

  private async resolveOrCreateDraft(
    manager: import('typeorm').EntityManager,
    dto: CreateProjectDto,
    actor: AuthUser,
  ): Promise<Project> {
    if (dto.draftProjectId) {
      const existing = await manager.findOne(Project, { where: { id: dto.draftProjectId } });
      if (!existing) throw new NotFoundException('Draft project not found');
      if (existing.status !== ProjectStatus.DRAFT && !existing.gbciDisplayId) {
        throw new ConflictException('Project is not in a registerable state');
      }
      this.projects.applyFields(existing, dto);
      existing.updatedBy = actor.id;
      await this.ensureMembership(manager, existing.id, actor);
      return existing;
    }
    if (dto.mode === 'register' && !dto.ratingSystemId) {
      throw new BadRequestException('ratingSystemId is required to register');
    }
    const project = manager.create(Project, { status: ProjectStatus.DRAFT });
    this.projects.applyFields(project, dto);
    project.createdBy = actor.id;
    project.updatedBy = actor.id;
    const saved = await manager.save(project);
    await this.ensureMembership(manager, saved.id, actor);
    return saved;
  }

  private async ensureMembership(
    manager: import('typeorm').EntityManager,
    projectId: string,
    actor: AuthUser,
  ): Promise<void> {
    const existing = await manager.findOne(ProjectMembership, {
      where: { userId: actor.id, projectId },
    });
    if (existing) return;
    const user = await this.users.findById(actor.id);
    const role =
      user?.greenRaterCredentialId ? ProjectRole.GREEN_RATER : ProjectRole.PROJECT_TEAM;
    const membership = manager.create(ProjectMembership, {
      userId: actor.id,
      projectId,
      projectRole: role,
      invitedBy: null,
      acceptedAt: new Date(),
      revokedAt: null,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await manager.save(membership);
  }

  private async safelyInitScorecard(project: Project, actorUserId: string): Promise<void> {
    try {
      await this.scorecard.initializeScorecard(project.id, project.ratingSystemId, actorUserId);
    } catch (err) {
      this.logger.warn(`Scorecard init deferred for ${project.id}: ${(err as Error).message}`);
    }
  }

  private sendConfirmationEmail(result: RegistrationResult, actor: AuthUser): void {
    const { project, invoice } = result;
    const context = {
      gbciDisplayId: project.gbciDisplayId,
      invoiceDisplayId: invoice.displayId,
      paymentChoice: invoice.paymentChoice,
      paymentStatus: invoice.status,
      totalCents: invoice.totalCents,
      currency: invoice.currency,
    };
    const subject = `Your LEED v4.1 SF project is registered: ${project.gbciDisplayId}`;
    if (project.ownerEmail) {
      this.notifications.send({
        channel: 'email',
        to: project.ownerEmail,
        subject,
        body: `Registration confirmed. Invoice ${invoice.displayId} (${invoice.status}).`,
        meta: context,
      });
    }
    if (actor.email && actor.email !== project.ownerEmail) {
      this.notifications.send({
        channel: 'email',
        to: actor.email,
        subject,
        body: `You registered project ${project.gbciDisplayId}. Invoice ${invoice.displayId}.`,
        meta: context,
      });
    }
  }

  private async recordAuditTrail(result: RegistrationResult): Promise<void> {
    const { project, invoice } = result;
    await this.audit.record({
      entityType: 'Project.created',
      entityId: project.id,
      action: AuditAction.CREATE,
      after: { name: project.name, gbciDisplayId: project.gbciDisplayId },
    });
    await this.audit.record({
      entityType: 'Invoice.generated',
      entityId: invoice.id,
      action: AuditAction.CREATE,
      after: { displayId: invoice.displayId, totalCents: invoice.totalCents },
    });
    await this.audit.record({
      entityType: 'Project.numberIssued',
      entityId: project.id,
      action: AuditAction.UPDATE,
      after: { gbciDisplayId: project.gbciDisplayId },
    });
    await this.audit.record({
      entityType: 'Project.status',
      entityId: project.id,
      action: AuditAction.TRANSITION,
      before: { status: ProjectStatus.DRAFT },
      after: { status: ProjectStatus.REGISTERED },
    });
  }
}
