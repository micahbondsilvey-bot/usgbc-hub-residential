import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WorkbookFieldDefinition } from './entities/workbook-field-definition.entity';
import { WorkbookFieldEntry } from './entities/workbook-field-entry.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import { SubmittalSlot } from './entities/submittal-slot.entity';
import { Submittal } from './entities/submittal.entity';
import { VerificationNote } from './entities/verification-note.entity';
import { WorkbookFieldDataType } from './enums';
import { WorkbookOrchestrator } from './workbook.orchestrator';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { StateLockService } from '../scorecard/state-lock.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  CreditWorkbookDto,
  SubmittalSlotDto,
  VerificationNoteDto,
  WorkbookDto,
  WorkbookFieldEntryDto,
  WriteFieldEntryDto,
} from './dto/workbook.dto';

export interface FieldWarning {
  fieldDefinitionId: string;
  reason: 'value_out_of_range';
  value: number;
  allowedMin: number | null;
  allowedMax: number | null;
}

@Injectable()
export class WorkbookService {
  constructor(
    @InjectRepository(WorkbookFieldDefinition)
    private readonly fieldDefs: Repository<WorkbookFieldDefinition>,
    @InjectRepository(WorkbookFieldEntry)
    private readonly entries: Repository<WorkbookFieldEntry>,
    @InjectRepository(SubmittalSlotDefinition)
    private readonly slotDefs: Repository<SubmittalSlotDefinition>,
    @InjectRepository(SubmittalSlot) private readonly slots: Repository<SubmittalSlot>,
    @InjectRepository(Submittal) private readonly submittals: Repository<Submittal>,
    @InjectRepository(VerificationNote) private readonly notes: Repository<VerificationNote>,
    @InjectRepository(ScorecardEntry) private readonly scorecard: Repository<ScorecardEntry>,
    private readonly orchestrator: WorkbookOrchestrator,
    private readonly stateLock: StateLockService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
  ) {}

  async getWorkbook(projectId: string, actor: AuthUser): Promise<WorkbookDto> {
    await this.assertMember(actor, projectId);
    const attempted = await this.scorecard.find({ where: { projectId, attempted: true } });
    const credits: CreditWorkbookDto[] = [];
    for (const sc of attempted) {
      credits.push(await this.buildCreditWorkbook(projectId, sc.creditId));
    }
    return { credits };
  }

  async getCreditWorkbook(
    projectId: string,
    creditId: string,
    actor: AuthUser,
  ): Promise<CreditWorkbookDto> {
    await this.assertMember(actor, projectId);
    return this.buildCreditWorkbook(projectId, creditId);
  }

  /** BL-8 — per-credit populated flags for view-tab activation. */
  async getFlags(
    projectId: string,
    actor: AuthUser,
  ): Promise<Record<string, { hasFieldEntries: boolean; hasSubmittals: boolean; hasNotes: boolean }>> {
    await this.assertMember(actor, projectId);
    const flags: Record<
      string,
      { hasFieldEntries: boolean; hasSubmittals: boolean; hasNotes: boolean }
    > = {};
    const ensure = (creditId: string) => {
      flags[creditId] ??= { hasFieldEntries: false, hasSubmittals: false, hasNotes: false };
      return flags[creditId];
    };

    const entries = await this.entries.find({ where: { projectId, archivedAt: IsNull() } });
    for (const e of entries) {
      if (this.entryHasValue(e)) ensure(e.creditId).hasFieldEntries = true;
    }
    const activeSlots = await this.slots.find({ where: { projectId, archivedAt: IsNull() } });
    for (const slot of activeSlots) {
      const files = await this.submittals.count({
        where: { slotId: slot.id, archivedAt: IsNull() },
      });
      if (files > 0) ensure(slot.creditId).hasSubmittals = true;
    }
    const noteRows = await this.notes.find({ where: { projectId } });
    for (const n of noteRows) {
      if (n.body != null && n.body !== '') ensure(n.creditId).hasNotes = true;
    }
    return flags;
  }

  /** BL-4 — write a field entry with coercion, validation, and derived recompute. */
  async writeFieldEntry(
    projectId: string,
    creditId: string,
    fieldDefinitionId: string,
    dto: WriteFieldEntryDto,
    actor: AuthUser,
  ): Promise<{ entry: WorkbookFieldEntryDto; warnings: FieldWarning[] }> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    if (!isAdmin && role !== ProjectRole.PROJECT_TEAM && role !== ProjectRole.GREEN_RATER) {
      throw new ForbiddenException('Only Project Team or Green Rater may edit field entries');
    }

    const def = await this.fieldDefs.findOne({ where: { id: fieldDefinitionId, creditId } });
    if (!def) throw new NotFoundException('Field definition not found for this credit');
    if (def.formulaKey && !isAdmin) {
      throw new ForbiddenException('Derived fields are computed and cannot be set directly');
    }

    let entry = await this.entries.findOne({ where: { projectId, fieldDefinitionId } });
    if (!entry) {
      entry = this.entries.create({
        projectId,
        creditId,
        fieldDefinitionId,
        derived: def.formulaKey != null,
        version: 1,
      });
    }

    const before = this.readRaw(entry, def.dataType);
    const warnings = this.applyValue(entry, def, dto.value ?? null);
    entry.derived = def.formulaKey != null;
    entry.version += 1;
    const saved = await this.entries.save(entry);

    const after = this.readRaw(saved, def.dataType);
    if ((before == null) !== (after == null)) {
      await this.audit.record({
        entityType: 'WorkbookFieldEntry',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        before: { value: before },
        after: { value: after },
      });
    }

    // BR-WV3 — recompute derived fields on this credit.
    await this.orchestrator.recomputeDerived(projectId, creditId);

    const refreshed = await this.entries.findOne({ where: { id: saved.id } });
    return { entry: this.toEntryDto(refreshed ?? saved, def), warnings };
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async buildCreditWorkbook(
    projectId: string,
    creditId: string,
  ): Promise<CreditWorkbookDto> {
    const defs = await this.fieldDefs.find({
      where: { creditId },
      order: { displayOrder: 'ASC' },
    });
    const entries = await this.entries.find({
      where: { projectId, creditId, archivedAt: IsNull() },
    });
    const entryByDef = new Map(entries.map((e) => [e.fieldDefinitionId, e]));
    const fieldEntries = defs
      .map((def) => {
        const entry = entryByDef.get(def.id);
        return entry ? this.toEntryDto(entry, def) : null;
      })
      .filter((x): x is WorkbookFieldEntryDto => x !== null);

    const slotDefs = await this.slotDefs.find({
      where: { creditId },
      order: { displayOrder: 'ASC' },
    });
    const slotRows = await this.slots.find({
      where: { projectId, creditId, archivedAt: IsNull() },
    });
    const slotByDef = new Map(slotRows.map((s) => [s.slotDefinitionId, s]));
    const slots: SubmittalSlotDto[] = [];
    for (const def of slotDefs) {
      const slot = slotByDef.get(def.id);
      if (!slot) continue;
      const files = await this.submittals.find({
        where: { slotId: slot.id, archivedAt: IsNull() },
        order: { uploadedAt: 'ASC' },
      });
      slots.push({
        id: slot.id,
        creditId,
        slotDefinitionId: def.id,
        slotKey: def.slotKey,
        label: def.label,
        requirementNote: def.requirementNote,
        required: def.required,
        multiUpload: def.multiUpload,
        files: files.map((f) => ({
          id: f.id,
          slotId: f.slotId,
          originalFileName: f.originalFileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          uploadedByUserId: f.uploadedByUserId,
          uploadedAt: f.uploadedAt,
        })),
      });
    }

    const notes = await this.loadNotes(projectId, creditId);

    return {
      creditId,
      fieldEntries,
      slots,
      notes,
      hasFieldEntries: fieldEntries.some((f) => f.value !== null),
      hasSubmittals: slots.some((s) => s.files.length > 0),
      hasNotes: notes.some((n) => n.body != null && n.body !== ''),
    };
  }

  private async loadNotes(projectId: string, creditId: string): Promise<VerificationNoteDto[]> {
    const columns: Array<'GREEN_RATER' | 'PROVIDER_QC' | 'REVIEWER'> = [
      'GREEN_RATER',
      'PROVIDER_QC',
      'REVIEWER',
    ];
    const rows = await this.notes.find({ where: { projectId, creditId } });
    return columns.map((column) => {
      const row = rows.find((r) => r.column === column);
      return {
        creditId,
        column,
        body: row?.body ?? null,
        savedByUserId: row?.savedByUserId ?? null,
        savedAt: row?.savedAt ?? null,
        version: row?.version ?? 0,
      };
    });
  }

  private applyValue(
    entry: WorkbookFieldEntry,
    def: WorkbookFieldDefinition,
    value: string | number | boolean | null,
  ): FieldWarning[] {
    entry.valueText = null;
    entry.valueNumeric = null;
    entry.valueBoolean = null;
    entry.valueDate = null;
    entry.valueEnum = null;
    const warnings: FieldWarning[] = [];
    if (value === null || value === '') return warnings;

    switch (def.dataType) {
      case WorkbookFieldDataType.TEXT:
        entry.valueText = String(value);
        break;
      case WorkbookFieldDataType.INTEGER:
      case WorkbookFieldDataType.DECIMAL: {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new BadRequestException('Value must be a finite number');
        if (def.dataType === WorkbookFieldDataType.INTEGER && !Number.isInteger(n)) {
          throw new BadRequestException('Value must be an integer');
        }
        entry.valueNumeric = String(n);
        const min = def.min != null ? Number(def.min) : null;
        const max = def.max != null ? Number(def.max) : null;
        if ((min != null && n < min) || (max != null && n > max)) {
          warnings.push({
            fieldDefinitionId: def.id,
            reason: 'value_out_of_range',
            value: n,
            allowedMin: min,
            allowedMax: max,
          });
        }
        break;
      }
      case WorkbookFieldDataType.BOOLEAN:
        entry.valueBoolean = value === true || value === 'true' || value === 1 || value === '1';
        break;
      case WorkbookFieldDataType.ENUM: {
        const str = String(value);
        if (!def.enumOptions || !def.enumOptions.includes(str)) {
          throw new BadRequestException('Value is not one of the allowed options');
        }
        entry.valueEnum = str;
        break;
      }
      case WorkbookFieldDataType.DATE: {
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Value must be a valid date');
        entry.valueDate = d.toISOString().slice(0, 10);
        break;
      }
    }
    return warnings;
  }

  private readRaw(
    entry: WorkbookFieldEntry,
    dataType: WorkbookFieldDataType,
  ): string | number | boolean | null {
    switch (dataType) {
      case WorkbookFieldDataType.INTEGER:
      case WorkbookFieldDataType.DECIMAL:
        return entry.valueNumeric != null ? Number(entry.valueNumeric) : null;
      case WorkbookFieldDataType.BOOLEAN:
        return entry.valueBoolean;
      case WorkbookFieldDataType.ENUM:
        return entry.valueEnum;
      case WorkbookFieldDataType.DATE:
        return entry.valueDate;
      default:
        return entry.valueText;
    }
  }

  private entryHasValue(entry: WorkbookFieldEntry): boolean {
    return (
      entry.valueText != null ||
      entry.valueNumeric != null ||
      entry.valueBoolean != null ||
      entry.valueDate != null ||
      entry.valueEnum != null
    );
  }

  private toEntryDto(
    entry: WorkbookFieldEntry,
    def: WorkbookFieldDefinition,
  ): WorkbookFieldEntryDto {
    return {
      id: entry.id,
      creditId: entry.creditId,
      fieldDefinitionId: entry.fieldDefinitionId,
      fieldKey: def.fieldKey,
      label: def.label,
      dataType: def.dataType,
      unit: def.unit,
      areaTag: def.areaTag,
      helpText: def.helpText,
      enumOptions: def.enumOptions,
      derived: entry.derived,
      required: def.required,
      value: this.readRaw(entry, def.dataType),
      displayOrder: def.displayOrder,
      version: entry.version,
    };
  }

  private async assertMember(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }
}
