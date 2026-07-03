import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Credit } from '../catalog/credit.entity';
import { WorkbookFieldDefinition } from './entities/workbook-field-definition.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import { WorkbookFieldDataType } from './enums';
import { hasFormula } from './calculator/formula-registry';
import { AuditStampHelper } from '../audit/audit-stamp.helper';

interface SeedField {
  fieldKey: string;
  label: string;
  helpText?: string;
  dataType: string;
  unit?: string;
  min?: number | null;
  max?: number | null;
  enumOptions?: string[];
  areaTag?: string;
  displayOrder: number;
  formulaKey?: string;
  required?: boolean;
}
interface SeedSlot {
  slotKey: string;
  label: string;
  requirementNote?: string;
  displayOrder: number;
  required?: boolean;
  multiUpload?: boolean;
}
interface SeedCredit {
  creditSlug: string;
  fields: SeedField[];
  slots: SeedSlot[];
}

const VALID_TYPES = new Set<string>(Object.values(WorkbookFieldDataType));

/** Loads the workbook catalog after the U2 catalog seeder (BR-WC1, BL-9). */
@Injectable()
export class WorkbookCatalogSeeder implements OnModuleInit {
  private readonly logger = new Logger(WorkbookCatalogSeeder.name);

  constructor(
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(WorkbookFieldDefinition)
    private readonly fieldDefs: Repository<WorkbookFieldDefinition>,
    @InjectRepository(SubmittalSlotDefinition)
    private readonly slotDefs: Repository<SubmittalSlotDefinition>,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  async onModuleInit(): Promise<void> {
    const path = join(process.cwd(), 'scripts', 'seed', 'leed-v41-sf-workbook.json');
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { credits: SeedCredit[] };

    let fieldCount = 0;
    let slotCount = 0;

    for (const creditSeed of data.credits) {
      const credit = await this.credits.findOne({ where: { slug: creditSeed.creditSlug } });
      if (!credit) {
        throw new Error(`Workbook seed references unknown credit slug: ${creditSeed.creditSlug}`);
      }
      for (const field of creditSeed.fields) {
        this.validateField(creditSeed.creditSlug, field);
        await this.upsertField(credit.id, field);
        fieldCount += 1;
      }
      for (const slot of creditSeed.slots) {
        await this.upsertSlot(credit.id, slot);
        slotCount += 1;
      }
    }

    this.logger.log(
      `Workbook catalog seeded — ${fieldCount} field defs, ${slotCount} slot defs across ${data.credits.length} credits.`,
    );
  }

  private validateField(creditSlug: string, field: SeedField): void {
    if (!VALID_TYPES.has(field.dataType)) {
      throw new Error(`Invalid dataType '${field.dataType}' on ${creditSlug}/${field.fieldKey}`);
    }
    if (field.dataType === 'enum' && (!field.enumOptions || field.enumOptions.length === 0)) {
      throw new Error(`enum field ${creditSlug}/${field.fieldKey} needs enumOptions`);
    }
    if (
      (field.dataType === 'integer' || field.dataType === 'decimal') &&
      field.min != null &&
      field.max != null &&
      field.min > field.max
    ) {
      throw new Error(`min>max on ${creditSlug}/${field.fieldKey}`);
    }
    if (field.formulaKey && !hasFormula(field.formulaKey)) {
      throw new Error(`Unknown formulaKey '${field.formulaKey}' on ${creditSlug}/${field.fieldKey}`);
    }
  }

  private async upsertField(creditId: string, field: SeedField): Promise<void> {
    const existing = await this.fieldDefs.findOne({
      where: { creditId, fieldKey: field.fieldKey },
    });
    const entity = existing ?? this.fieldDefs.create();
    entity.creditId = creditId;
    entity.fieldKey = field.fieldKey;
    entity.label = field.label;
    entity.helpText = field.helpText ?? null;
    entity.dataType = field.dataType as WorkbookFieldDataType;
    entity.unit = field.unit ?? null;
    entity.min = field.min != null ? String(field.min) : null;
    entity.max = field.max != null ? String(field.max) : null;
    entity.enumOptions = field.enumOptions ?? null;
    entity.areaTag = field.areaTag ?? null;
    entity.displayOrder = field.displayOrder;
    entity.formulaKey = field.formulaKey ?? null;
    entity.required = field.required ?? false;
    if (existing) this.auditStamp.stampUpdate(entity, null);
    else this.auditStamp.stampCreate(entity, null);
    await this.fieldDefs.save(entity);
  }

  private async upsertSlot(creditId: string, slot: SeedSlot): Promise<void> {
    const existing = await this.slotDefs.findOne({
      where: { creditId, slotKey: slot.slotKey },
    });
    const entity = existing ?? this.slotDefs.create();
    entity.creditId = creditId;
    entity.slotKey = slot.slotKey;
    entity.label = slot.label;
    entity.requirementNote = slot.requirementNote ?? null;
    entity.displayOrder = slot.displayOrder;
    entity.required = slot.required ?? false;
    entity.multiUpload = slot.multiUpload ?? false;
    if (existing) this.auditStamp.stampUpdate(entity, null);
    else this.auditStamp.stampCreate(entity, null);
    await this.slotDefs.save(entity);
  }
}
