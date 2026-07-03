import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Credit } from '../catalog/credit.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { WorkbookFieldDefinition } from './entities/workbook-field-definition.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import { WorkbookFieldEntry } from './entities/workbook-field-entry.entity';
import { SubmittalSlot } from './entities/submittal-slot.entity';
import { Submittal } from './entities/submittal.entity';
import { VerificationNote } from './entities/verification-note.entity';
import { WorkbookCatalogSeeder } from './workbook-catalog.seeder';
import { WorkbookOrchestrator } from './workbook.orchestrator';
import { WorkbookService } from './workbook.service';
import { NotesService } from './notes.service';
import { SubmittalsOrchestrator } from './submittals.orchestrator';
import { WorkbookDemoSeeder } from './workbook-demo.seeder';
import { WorkbookController } from './workbook.controller';
import { SubmittalFilesController, SubmittalsController } from './submittals.controller';
import { LocalDiskStorageProvider } from './storage/local-disk-storage.provider';
import { FILE_STORAGE_PROVIDER } from './storage/file-storage.provider';
import { MembershipModule } from '../membership/membership.module';
import { ScorecardModule } from '../scorecard/scorecard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Credit,
      ScorecardEntry,
      WorkbookFieldDefinition,
      SubmittalSlotDefinition,
      WorkbookFieldEntry,
      SubmittalSlot,
      Submittal,
      VerificationNote,
    ]),
    MembershipModule,
    ScorecardModule,
  ],
  controllers: [WorkbookController, SubmittalsController, SubmittalFilesController],
  providers: [
    WorkbookCatalogSeeder,
    WorkbookOrchestrator,
    WorkbookService,
    NotesService,
    SubmittalsOrchestrator,
    WorkbookDemoSeeder,
    LocalDiskStorageProvider,
    { provide: FILE_STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
  ],
  exports: [WorkbookOrchestrator, WorkbookService],
})
export class WorkbookModule {}
