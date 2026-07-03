import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { Invoice } from '../projects/invoice.entity';
import { CertificationAgreement } from '../projects/certification-agreement.entity';
import { ProjectMembership } from '../membership/project-membership.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Review } from '../review/review.entity';
import { SubmittalQualityScore } from '../review/submittal-quality-score.entity';
import { Submittal } from '../workbook/entities/submittal.entity';
import { VerificationNote } from '../workbook/entities/verification-note.entity';
import { DashboardsService } from './dashboards.service';
import { DashboardsController, ReviewerDashboardController } from './dashboards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Invoice,
      CertificationAgreement,
      ProjectMembership,
      ScorecardEntry,
      Review,
      SubmittalQualityScore,
      Submittal,
      VerificationNote,
    ]),
  ],
  controllers: [DashboardsController, ReviewerDashboardController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
