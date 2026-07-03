import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeSchedule } from './fee-schedule.entity';
import { FeeScheduleSeeder } from './fee-schedule.seeder';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeeSchedule])],
  controllers: [FeesController],
  providers: [FeeScheduleSeeder, FeesService],
  exports: [FeeScheduleSeeder, FeesService],
})
export class FeesModule {}
