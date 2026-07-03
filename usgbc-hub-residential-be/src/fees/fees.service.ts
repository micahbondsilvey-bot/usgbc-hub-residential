import { Injectable } from '@nestjs/common';
import { FeeScheduleSeeder } from './fee-schedule.seeder';
import { compute, FeeQuote } from './calculator/fee.calculator';
import { MembershipLevel } from '../projects/enums';

/** Fee quoting service — resolves the effective schedule then runs the pure calculator. */
@Injectable()
export class FeesService {
  constructor(private readonly schedules: FeeScheduleSeeder) {}

  async quote(ratingSystemSlug: string, membershipLevel: MembershipLevel): Promise<FeeQuote> {
    const schedule = await this.schedules.findEffective(ratingSystemSlug);
    return compute({ ratingSystemSlug, membershipLevel, schedule });
  }
}
