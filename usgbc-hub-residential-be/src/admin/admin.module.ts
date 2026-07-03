import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectMembership } from '../membership/project-membership.entity';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { Review } from '../review/review.entity';
import { SubmittalQualityScore } from '../review/submittal-quality-score.entity';
import { User } from '../users/user.entity';
import { AdminPipelineService } from './pipeline/admin-pipeline.service';
import { AdminPipelineController } from './pipeline/admin-pipeline.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMembership,
      ScorecardEntry,
      Review,
      SubmittalQualityScore,
      User,
    ]),
  ],
  controllers: [AdminPipelineController],
  providers: [AdminPipelineService],
})
export class AdminModule {}
