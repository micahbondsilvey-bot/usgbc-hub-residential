import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { Invoice } from '../projects/invoice.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Review } from '../review/review.entity';
import { PortfolioService } from './portfolio.service';
import { PortfolioFeeService } from './portfolio-fee.service';
import { PortfolioSubmissionOrchestrator } from './portfolio-submission.orchestrator';
import { PortfolioController } from './portfolio.controller';
import { ScorecardModule } from '../scorecard/scorecard.module';
import { MembershipModule } from '../membership/membership.module';
import { CatalogModule } from '../catalog/catalog.module';
import { FeesModule } from '../fees/fees.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Invoice, ScorecardEntry, Review]),
    ScorecardModule,
    MembershipModule,
    CatalogModule,
    FeesModule,
    ReviewModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioFeeService, PortfolioSubmissionOrchestrator],
  exports: [PortfolioService],
})
export class PortfolioModule {}
