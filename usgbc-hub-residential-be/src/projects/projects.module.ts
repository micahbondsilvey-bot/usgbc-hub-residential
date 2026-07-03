import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { Invoice } from './invoice.entity';
import { CertificationAgreement } from './certification-agreement.entity';
import { BulkRegistrationBatch } from './bulk-registration-batch.entity';
import { BulkRegistrationRow } from './bulk-registration-row.entity';
import { ProjectsService } from './projects.service';
import { AgreementService } from './agreement.service';
import { InvoiceService } from './invoice.service';
import { PaymentProvider } from './payment.provider';
import { ProjectNumberGenerator } from './project-number.generator';
import { RegistrationOrchestrator } from './registration.orchestrator';
import { BulkRegistrationOrchestrator } from './bulk-registration.orchestrator';
import { RegistrationDdlBootstrapper } from './registration.ddl-bootstrapper';
import { ProjectsDemoSeeder } from './projects-demo.seeder';
import { ProjectsController } from './projects.controller';
import { BulkController } from './bulk.controller';
import { FeesModule } from '../fees/fees.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ScorecardModule } from '../scorecard/scorecard.module';
import { MembershipModule } from '../membership/membership.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Invoice,
      CertificationAgreement,
      BulkRegistrationBatch,
      BulkRegistrationRow,
    ]),
    FeesModule,
    CatalogModule,
    ScorecardModule,
    MembershipModule,
    UsersModule,
  ],
  controllers: [ProjectsController, BulkController],
  providers: [
    ProjectsService,
    AgreementService,
    InvoiceService,
    PaymentProvider,
    ProjectNumberGenerator,
    RegistrationOrchestrator,
    BulkRegistrationOrchestrator,
    RegistrationDdlBootstrapper,
    ProjectsDemoSeeder,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
