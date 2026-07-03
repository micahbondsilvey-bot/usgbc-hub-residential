import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScorecardEntry } from './scorecard-entry.entity';
import { Credit } from '../catalog/credit.entity';
import { CreditPointValue } from '../catalog/credit-point-value.entity';
import { Project } from '../projects/project.entity';
import { ScorecardService } from './scorecard.service';
import { ScorecardController } from './scorecard.controller';
import { StateLockService } from './state-lock.service';
import { DemoSeeder } from './demo.seeder';
import { CatalogModule } from '../catalog/catalog.module';
import { MembershipModule } from '../membership/membership.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScorecardEntry, Credit, CreditPointValue, Project]),
    CatalogModule,
    MembershipModule,
    UsersModule,
  ],
  controllers: [ScorecardController],
  providers: [ScorecardService, StateLockService, DemoSeeder],
  exports: [ScorecardService, StateLockService],
})
export class ScorecardModule {}
