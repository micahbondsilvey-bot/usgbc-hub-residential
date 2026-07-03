import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScorecardEntry } from './scorecard-entry.entity';
import { Credit } from '../catalog/credit.entity';
import { CreditPointValue } from '../catalog/credit-point-value.entity';
import { CatalogService } from '../catalog/catalog.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import { StateLockService } from './state-lock.service';
import { WorkbookAttemptHookRegistry } from '../common/hooks/workbook-attempt-hook.registry';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { UpdateScorecardEntryDto, ScorecardEntryDto } from './dto/scorecard.dto';
import { ScorecardDto } from './dto/scorecard-summary.dto';
import { compute, ScorecardSummary } from './calculator/scorecard-summary.calculator';
import { computeWarnings, ScorecardWarning } from './calculator/scorecard-warnings';

type NumericColumn = 'attemptedPoints' | 'verifiedPoints' | 'awardedPoints';

const COLUMN_WRITERS: Record<'attempted' | NumericColumn, ProjectRole[]> = {
  attempted: [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER],
  attemptedPoints: [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER],
  verifiedPoints: [ProjectRole.GREEN_RATER],
  awardedPoints: [ProjectRole.REVIEWER],
};

@Injectable()
export class ScorecardService {
  constructor(
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(CreditPointValue) private readonly tiers: Repository<CreditPointValue>,
    private readonly catalog: CatalogService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
    private readonly auditStamp: AuditStampHelper,
    private readonly stateLock: StateLockService,
    private readonly attemptHooks: WorkbookAttemptHookRegistry,
  ) {}

  /** BL-3 — create one entry per credit; prereqs attempted=true. Idempotent. */
  async initializeScorecard(
    projectId: string,
    ratingSystemId: string,
    actorUserId: string | null = null,
  ): Promise<void> {
    const dto = await this.catalog.getRatingSystem(ratingSystemId);
    const allCredits = dto.categories.flatMap((c) => c.credits);
    for (const credit of allCredits) {
      const existing = await this.entries.findOne({ where: { projectId, creditId: credit.id } });
      if (existing) continue;
      const entry = this.entries.create({
        projectId,
        creditId: credit.id,
        attempted: credit.kind === 'prerequisite',
        attemptedPoints: 0,
        verifiedPoints: 0,
        awardedPoints: 0,
        selectedPointValueId: null,
        version: 1,
      });
      this.auditStamp.stampCreate(entry, actorUserId);
      await this.entries.save(entry);
      if (entry.attempted) {
        await this.attemptHooks.notify({
          projectId,
          creditId: credit.id,
          attempted: true,
          actorUserId,
        });
      }
    }
  }

  /** BL-6 — entries + summary + warnings. Caller must be member/Admin. */
  async getScorecard(projectId: string, ratingSystemId?: string): Promise<ScorecardDto> {
    const rsId = ratingSystemId ?? (await this.catalog.getDefaultRatingSystem()).id;
    const calcCatalog = await this.catalog.getCalcCatalog(rsId);
    const entries = await this.entries.find({ where: { projectId } });

    const summary = this.summaryFrom(entries, calcCatalog);
    const warnings = await this.warningsFor(entries);
    return {
      entries: entries.map((e) => this.toDto(e)),
      summary,
      warnings,
    };
  }

  async getSummary(projectId: string, ratingSystemId?: string): Promise<ScorecardSummary> {
    const rsId = ratingSystemId ?? (await this.catalog.getDefaultRatingSystem()).id;
    const calcCatalog = await this.catalog.getCalcCatalog(rsId);
    const entries = await this.entries.find({ where: { projectId } });
    return this.summaryFrom(entries, calcCatalog);
  }

  /** BL-5 — partial update with column-level authz, tiers, and warnings. */
  async updateEntry(
    projectId: string,
    creditId: string,
    dto: UpdateScorecardEntryDto,
    actor: AuthUser,
  ): Promise<{ entry: ScorecardEntryDto; warnings: ScorecardWarning[] }> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    if (!isAdmin && !role) throw new ForbiddenException('Not a member of this project');

    const credit = await this.credits.findOne({ where: { id: creditId } });
    if (!credit) throw new NotFoundException('Credit not found');

    const entry = await this.findOrCreateEntry(projectId, creditId, actor.id);
    const previousAttempted = entry.attempted;

    // Tier selection (BR-S5): validate + set attemptedPoints from the tier.
    if (dto.selectedPointValueId !== undefined) {
      this.assertColumnAllowed('attemptedPoints', role, isAdmin);
      const tier = await this.tiers.findOne({
        where: { id: dto.selectedPointValueId, creditId },
      });
      if (!tier) throw new BadRequestException('Selected tier does not belong to this credit');
      entry.selectedPointValueId = tier.id;
      entry.attemptedPoints = tier.points;
    }

    if (dto.attempted !== undefined) {
      this.assertColumnAllowed('attempted', role, isAdmin);
      if (credit.kind === 'prerequisite' && dto.attempted === false) {
        throw new BadRequestException('Prerequisites cannot be un-attempted');
      }
      entry.attempted = dto.attempted;
    }

    if (dto.attemptedPoints !== undefined) {
      this.assertColumnAllowed('attemptedPoints', role, isAdmin);
      entry.attemptedPoints = dto.attemptedPoints;
    }
    if (dto.verifiedPoints !== undefined) {
      this.assertColumnAllowed('verifiedPoints', role, isAdmin);
      entry.verifiedPoints = dto.verifiedPoints;
    }
    if (dto.awardedPoints !== undefined) {
      this.assertColumnAllowed('awardedPoints', role, isAdmin);
      entry.awardedPoints = dto.awardedPoints;
    }

    entry.version += 1;
    const saved = await this.entries.save(entry);

    // Explicit audit-log row on attempted flips (BR-S10).
    if (dto.attempted !== undefined && previousAttempted !== saved.attempted) {
      await this.audit.record({
        entityType: 'ScorecardEntry.attempted',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        before: { attempted: previousAttempted },
        after: { attempted: saved.attempted },
      });
      // Notify the workbook to materialize/archive (BR-WX2). Fire-and-forget.
      await this.attemptHooks.notify({
        projectId,
        creditId,
        attempted: saved.attempted,
        actorUserId: actor.id,
      });
    }

    const warnings = computeWarnings([this.toWarnable(saved)], [this.toWarnableCredit(credit)]);
    return { entry: this.toDto(saved), warnings };
  }

  /** BR-S7 — soft-clear point columns and set attempted=false (optional credits). */
  async unAttempt(
    projectId: string,
    creditId: string,
    actor: AuthUser,
  ): Promise<ScorecardEntryDto> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    this.assertColumnAllowed('attempted', role, isAdmin);

    const credit = await this.credits.findOne({ where: { id: creditId } });
    if (!credit) throw new NotFoundException('Credit not found');
    if (credit.kind === 'prerequisite') {
      throw new BadRequestException('Prerequisites cannot be un-attempted');
    }

    const entry = await this.findOrCreateEntry(projectId, creditId, actor.id);
    const previousAttempted = entry.attempted;
    entry.attempted = false;
    entry.attemptedPoints = 0;
    entry.verifiedPoints = 0;
    entry.awardedPoints = 0;
    entry.selectedPointValueId = null;
    entry.version += 1;
    const saved = await this.entries.save(entry);

    if (previousAttempted) {
      await this.audit.record({
        entityType: 'ScorecardEntry.attempted',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        before: { attempted: true },
        after: { attempted: false },
        reason: 'un-attempt soft clear',
      });
      await this.attemptHooks.notify({
        projectId,
        creditId,
        attempted: false,
        actorUserId: actor.id,
      });
    }
    return this.toDto(saved);
  }

  private assertColumnAllowed(
    column: 'attempted' | NumericColumn,
    role: ProjectRole | null,
    isAdmin: boolean,
  ): void {
    if (isAdmin) return;
    if (!role || !COLUMN_WRITERS[column].includes(role)) {
      throw new ForbiddenException(`Your role may not modify ${column}`);
    }
  }

  private async findOrCreateEntry(
    projectId: string,
    creditId: string,
    actorUserId: string,
  ): Promise<ScorecardEntry> {
    const existing = await this.entries.findOne({ where: { projectId, creditId } });
    if (existing) return existing;
    const entry = this.entries.create({
      projectId,
      creditId,
      attempted: false,
      attemptedPoints: 0,
      verifiedPoints: 0,
      awardedPoints: 0,
      selectedPointValueId: null,
      version: 1,
    });
    this.auditStamp.stampCreate(entry, actorUserId);
    return entry;
  }

  private summaryFrom(
    entries: ScorecardEntry[],
    calcCatalog: Awaited<ReturnType<CatalogService['getCalcCatalog']>>,
  ): ScorecardSummary {
    return compute(
      entries.map((e) => ({
        creditId: e.creditId,
        attempted: e.attempted,
        attemptedPoints: e.attemptedPoints,
        verifiedPoints: e.verifiedPoints,
        awardedPoints: e.awardedPoints,
      })),
      calcCatalog,
    );
  }

  private async warningsFor(entries: ScorecardEntry[]): Promise<ScorecardWarning[]> {
    if (entries.length === 0) return [];
    const creditRows = await this.credits.find({
      where: entries.map((e) => ({ id: e.creditId })),
    });
    return computeWarnings(
      entries.map((e) => this.toWarnable(e)),
      creditRows.map((c) => this.toWarnableCredit(c)),
    );
  }

  private toWarnable(e: ScorecardEntry) {
    return {
      creditId: e.creditId,
      attempted: e.attempted,
      attemptedPoints: e.attemptedPoints,
      verifiedPoints: e.verifiedPoints,
      awardedPoints: e.awardedPoints,
    };
  }

  private toWarnableCredit(c: Credit) {
    return { id: c.id, kind: c.kind, pointsMin: c.pointsMin, pointsMax: c.pointsMax };
  }

  private toDto(e: ScorecardEntry): ScorecardEntryDto {
    return {
      id: e.id,
      projectId: e.projectId,
      creditId: e.creditId,
      attempted: e.attempted,
      attemptedPoints: e.attemptedPoints,
      verifiedPoints: e.verifiedPoints,
      awardedPoints: e.awardedPoints,
      selectedPointValueId: e.selectedPointValueId,
      version: e.version,
      notes: e.notes,
    };
  }
}
