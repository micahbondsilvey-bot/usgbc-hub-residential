import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Credit } from '../catalog/credit.entity';
import { WorkbookFieldDefinition } from './entities/workbook-field-definition.entity';
import { WorkbookFieldEntry } from './entities/workbook-field-entry.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import { SubmittalSlot } from './entities/submittal-slot.entity';
import { Submittal } from './entities/submittal.entity';
import { VerificationNote } from './entities/verification-note.entity';
import { NoteColumn } from './enums';
import { WorkbookOrchestrator } from './workbook.orchestrator';
import { FILE_STORAGE_PROVIDER, FileStorageProvider } from './storage/file-storage.provider';
import { buildKey } from './storage/key.utils';
import { DEMO_PROJECT_UUID } from '../scorecard/demo.seeder';

/** BL-10 — materialize + pre-populate a slice of the demo workbook. Idempotent. */
@Injectable()
export class WorkbookDemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(WorkbookDemoSeeder.name);

  constructor(
    @InjectRepository(ScorecardEntry) private readonly scorecard: Repository<ScorecardEntry>,
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(WorkbookFieldDefinition)
    private readonly fieldDefs: Repository<WorkbookFieldDefinition>,
    @InjectRepository(WorkbookFieldEntry)
    private readonly entries: Repository<WorkbookFieldEntry>,
    @InjectRepository(SubmittalSlotDefinition)
    private readonly slotDefs: Repository<SubmittalSlotDefinition>,
    @InjectRepository(SubmittalSlot) private readonly slots: Repository<SubmittalSlot>,
    @InjectRepository(Submittal) private readonly submittals: Repository<Submittal>,
    @InjectRepository(VerificationNote) private readonly notes: Repository<VerificationNote>,
    @Inject(FILE_STORAGE_PROVIDER) private readonly storage: FileStorageProvider,
    private readonly orchestrator: WorkbookOrchestrator,
  ) {}

  async onModuleInit(): Promise<void> {
    // 1. Materialize the workbook for every attempted demo credit.
    const attempted = await this.scorecard.find({
      where: { projectId: DEMO_PROJECT_UUID, attempted: true },
    });
    for (const sc of attempted) {
      await this.orchestrator.materializeForCredit(DEMO_PROJECT_UUID, sc.creditId, null);
    }

    // 2. Populate compact-development inputs so the formulas produce a result.
    const compact = await this.credits.findOne({ where: { slug: 'lt_compact_development' } });
    if (compact) {
      await this.setNumeric(compact.id, 'lt_compact_units', 24);
      await this.setNumeric(compact.id, 'lt_compact_acres', 3);
      await this.orchestrator.recomputeDerived(DEMO_PROJECT_UUID, compact.id);
      await this.seedSubmittal(compact.id, 'lt_compact_calc');
      await this.seedNotes(compact.id);
    }

    this.logger.log('Demo workbook seeded.');
  }

  private async setNumeric(creditId: string, fieldKey: string, value: number): Promise<void> {
    const def = await this.fieldDefs.findOne({ where: { creditId, fieldKey } });
    if (!def) return;
    const entry = await this.entries.findOne({
      where: { projectId: DEMO_PROJECT_UUID, fieldDefinitionId: def.id },
    });
    if (!entry || (entry.updatedBy !== null && entry.valueNumeric !== null)) return;
    entry.valueNumeric = String(value);
    entry.valueText = null;
    entry.valueBoolean = null;
    entry.valueDate = null;
    entry.valueEnum = null;
    await this.entries.save(entry);
  }

  private async seedSubmittal(creditId: string, slotKey: string): Promise<void> {
    const slotDef = await this.slotDefs.findOne({ where: { creditId, slotKey } });
    if (!slotDef) return;
    let slot = await this.slots.findOne({
      where: { projectId: DEMO_PROJECT_UUID, slotDefinitionId: slotDef.id },
    });
    if (!slot) {
      slot = await this.slots.save(
        this.slots.create({
          projectId: DEMO_PROJECT_UUID,
          creditId,
          slotDefinitionId: slotDef.id,
          archivedAt: null,
          version: 1,
        }),
      );
    }
    const existing = await this.submittals.count({ where: { slotId: slot.id, archivedAt: IsNull() } });
    if (existing > 0) return;

    const safeFileName = 'demo-compact-calculation.txt';
    const storageKey = buildKey(DEMO_PROJECT_UUID, creditId, slotKey, safeFileName);
    const bytes = Buffer.from('Demo compact development calculation: 24 units / 3 acres = 8 uph.\n');
    await this.storage.put({
      key: storageKey,
      bytes,
      contentType: 'text/plain',
      contentLength: bytes.length,
    });
    await this.submittals.save(
      this.submittals.create({
        slotId: slot.id,
        projectId: DEMO_PROJECT_UUID,
        creditId,
        originalFileName: safeFileName,
        safeFileName,
        mimeType: 'text/plain',
        sizeBytes: bytes.length,
        storageKey,
        uploadedByUserId: DEMO_PROJECT_UUID,
        uploadedAt: new Date(),
        archivedAt: null,
      }),
    );
  }

  private async seedNotes(creditId: string): Promise<void> {
    const samples: Array<[NoteColumn, string]> = [
      [NoteColumn.GREEN_RATER, 'Density verified on site; 24 units across 3 buildable acres.'],
      [NoteColumn.PROVIDER_QC, 'QC reviewed the density worksheet — calculation confirmed.'],
      [NoteColumn.REVIEWER, 'Looks complete. Awaiting final submittal package.'],
    ];
    for (const [column, body] of samples) {
      const existing = await this.notes.findOne({
        where: { projectId: DEMO_PROJECT_UUID, creditId, column },
      });
      if (existing) continue;
      await this.notes.save(
        this.notes.create({
          projectId: DEMO_PROJECT_UUID,
          creditId,
          column,
          body,
          savedByUserId: null,
          savedAt: new Date(),
          version: 1,
        }),
      );
    }
  }
}
