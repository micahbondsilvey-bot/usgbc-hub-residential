import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WorkbookFieldDefinition } from './entities/workbook-field-definition.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import { WorkbookFieldEntry } from './entities/workbook-field-entry.entity';
import { SubmittalSlot } from './entities/submittal-slot.entity';
import { WorkbookFieldDataType } from './enums';
import { FormulaScope, FormulaValue, runFormula } from './calculator/formula-registry';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import {
  AttemptChangeEvent,
  WorkbookAttemptHookRegistry,
} from '../common/hooks/workbook-attempt-hook.registry';

/** Materialize/archive workbook rows on attempted changes + derived recompute (BL-1/2, BR-WV3). */
@Injectable()
export class WorkbookOrchestrator implements OnModuleInit {
  constructor(
    @InjectRepository(WorkbookFieldDefinition)
    private readonly fieldDefs: Repository<WorkbookFieldDefinition>,
    @InjectRepository(SubmittalSlotDefinition)
    private readonly slotDefs: Repository<SubmittalSlotDefinition>,
    @InjectRepository(WorkbookFieldEntry)
    private readonly entries: Repository<WorkbookFieldEntry>,
    @InjectRepository(SubmittalSlot)
    private readonly slots: Repository<SubmittalSlot>,
    private readonly audit: AuditService,
    private readonly auditStamp: AuditStampHelper,
    private readonly hooks: WorkbookAttemptHookRegistry,
  ) {}

  onModuleInit(): void {
    this.hooks.register((event: AttemptChangeEvent) =>
      event.attempted
        ? this.materializeForCredit(event.projectId, event.creditId, event.actorUserId)
        : this.archiveForCredit(event.projectId, event.creditId, event.actorUserId),
    );
  }

  /** BL-1 — eager materialization; idempotent; clears archivedAt on re-attempt. */
  async materializeForCredit(
    projectId: string,
    creditId: string,
    actorUserId: string | null,
  ): Promise<void> {
    const fieldDefs = await this.fieldDefs.find({ where: { creditId } });
    const slotDefs = await this.slotDefs.find({ where: { creditId } });
    if (fieldDefs.length === 0 && slotDefs.length === 0) return;

    let created = 0;
    for (const def of fieldDefs) {
      const existing = await this.entries.findOne({
        where: { projectId, fieldDefinitionId: def.id },
      });
      if (existing) {
        if (existing.archivedAt) {
          existing.archivedAt = null;
          existing.version += 1;
          await this.entries.save(existing);
        }
        continue;
      }
      const entry = this.entries.create({
        projectId,
        creditId,
        fieldDefinitionId: def.id,
        derived: def.formulaKey != null,
        archivedAt: null,
        version: 1,
      });
      this.auditStamp.stampCreate(entry, actorUserId);
      await this.entries.save(entry);
      created += 1;
    }

    for (const def of slotDefs) {
      const existing = await this.slots.findOne({
        where: { projectId, slotDefinitionId: def.id },
      });
      if (existing) {
        if (existing.archivedAt) {
          existing.archivedAt = null;
          existing.version += 1;
          await this.slots.save(existing);
        }
        continue;
      }
      const slot = this.slots.create({
        projectId,
        creditId,
        slotDefinitionId: def.id,
        archivedAt: null,
        version: 1,
      });
      this.auditStamp.stampCreate(slot, actorUserId);
      await this.slots.save(slot);
      created += 1;
    }

    if (created > 0) {
      await this.audit.record({
        entityType: 'Workbook.materialized',
        entityId: creditId,
        action: AuditAction.CREATE,
        after: { projectId, fieldRows: fieldDefs.length, slotRows: slotDefs.length },
        actorUserId,
      });
    }
  }

  /** BL-2 — soft-archive on un-attempt (files untouched). */
  async archiveForCredit(
    projectId: string,
    creditId: string,
    actorUserId: string | null,
  ): Promise<void> {
    const now = new Date();
    await this.entries.update({ projectId, creditId, archivedAt: IsNull() }, { archivedAt: now });
    await this.slots.update({ projectId, creditId, archivedAt: IsNull() }, { archivedAt: now });
    await this.audit.record({
      entityType: 'Workbook.archived',
      entityId: creditId,
      action: AuditAction.UPDATE,
      after: { projectId },
      actorUserId,
    });
  }

  /** BR-WV3 — recompute all derived fields on a credit from current inputs. */
  async recomputeDerived(projectId: string, creditId: string): Promise<void> {
    const defs = await this.fieldDefs.find({ where: { creditId } });
    if (defs.length === 0) return;
    const entries = await this.entries.find({
      where: { projectId, creditId, archivedAt: IsNull() },
    });
    const defById = new Map(defs.map((d) => [d.id, d]));
    const valueByKey = new Map<string, FormulaValue>();
    for (const entry of entries) {
      const def = defById.get(entry.fieldDefinitionId);
      if (def) valueByKey.set(def.fieldKey, this.readValue(entry, def.dataType));
    }
    const scope: FormulaScope = { get: (key) => valueByKey.get(key) ?? null };

    for (const def of defs) {
      if (!def.formulaKey) continue;
      const entry = entries.find((e) => e.fieldDefinitionId === def.id);
      if (!entry) continue;
      const value = runFormula(def.formulaKey, scope);
      this.writeValue(entry, def.dataType, value);
      entry.derived = true;
      entry.version += 1;
      await this.entries.save(entry);
    }
  }

  private readValue(entry: WorkbookFieldEntry, dataType: WorkbookFieldDataType): FormulaValue {
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

  private writeValue(
    entry: WorkbookFieldEntry,
    dataType: WorkbookFieldDataType,
    value: FormulaValue,
  ): void {
    entry.valueText = null;
    entry.valueNumeric = null;
    entry.valueBoolean = null;
    entry.valueDate = null;
    entry.valueEnum = null;
    if (value === null) return;
    switch (dataType) {
      case WorkbookFieldDataType.INTEGER:
      case WorkbookFieldDataType.DECIMAL:
        entry.valueNumeric = String(value);
        break;
      case WorkbookFieldDataType.BOOLEAN:
        entry.valueBoolean = Boolean(value);
        break;
      case WorkbookFieldDataType.ENUM:
        entry.valueEnum = String(value);
        break;
      case WorkbookFieldDataType.DATE:
        entry.valueDate = String(value);
        break;
      default:
        entry.valueText = String(value);
    }
  }
}
