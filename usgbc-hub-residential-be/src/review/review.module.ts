import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { SubmittalQualityScore } from './submittal-quality-score.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { VerificationNote } from '../workbook/entities/verification-note.entity';
import { ReviewService } from './review.service';
import { ReviewReportService } from './review-report.service';
import { ReviewNumberGenerator } from './review-number.generator';
import { ReviewController } from './review.controller';
import { ProjectsModule } from '../projects/projects.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MembershipModule } from '../membership/membership.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, SubmittalQualityScore, ScorecardEntry, VerificationNote]),
    ProjectsModule,
    CatalogModule,
    MembershipModule,
    UsersModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewReportService, ReviewNumberGenerator],
  exports: [ReviewService],
})
export class ReviewModule {}
