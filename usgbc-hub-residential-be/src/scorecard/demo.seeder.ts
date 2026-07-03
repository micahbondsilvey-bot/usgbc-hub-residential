import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScorecardEntry } from './scorecard-entry.entity';
import { ScorecardService } from './scorecard.service';
import { Credit } from '../catalog/credit.entity';
import { CreditPointValue } from '../catalog/credit-point-value.entity';
import { CatalogService } from '../catalog/catalog.service';
import { UsersService } from '../users/users.service';
import { MembershipService } from '../membership/membership.service';
import { ProjectRole } from '../auth/enums/role.enum';

/** Fixed placeholder demo project id (Unit 3 replaces this with a real Project). */
export const DEMO_PROJECT_UUID = '00000000-0000-4000-8000-000000000001';

/** Curated awarded points per optional credit → lands the demo in the Silver band. */
const DEMO_AWARDS: Record<string, number> = {
  lt_site_selection: 8,
  lt_compact_development: 3,
  ss_rainwater_management: 3,
  wa_total_water_use: 6,
  wa_indoor_water_use: 6,
  ea_annual_energy_use: 10,
  ea_renewable_energy: 5,
  mr_construction_waste_management: 4,
  eq_low_emitting_products: 3,
  eq_air_testing: 5,
};

const DEMO_MEMBERS: Array<{ email: string; role: ProjectRole }> = [
  { email: 'team@residential.test', role: ProjectRole.PROJECT_TEAM },
  { email: 'rater@residential.test', role: ProjectRole.GREEN_RATER },
  { email: 'reviewer@residential.test', role: ProjectRole.REVIEWER },
];

/**
 * BL-8 — seed a demo project, reconcile demo memberships, initialize the
 * scorecard, and pre-award a curated subset so the summary lands in Silver.
 * Idempotent; never overwrites entries a real user has edited (updatedBy set).
 */
@Injectable()
export class DemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(DemoSeeder.name);

  constructor(
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(CreditPointValue) private readonly tiers: Repository<CreditPointValue>,
    private readonly scorecard: ScorecardService,
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
    private readonly membership: MembershipService,
  ) {}

  async onModuleInit(): Promise<void> {
    // 1. Reconcile demo memberships onto the placeholder project.
    for (const member of DEMO_MEMBERS) {
      const user = await this.users.findByEmail(member.email);
      if (!user) continue;
      await this.membership.addMember(user.id, DEMO_PROJECT_UUID, member.role, null, null);
    }

    // 2. Initialize the scorecard for the demo project.
    const ratingSystem = await this.catalog.getDefaultRatingSystem();
    await this.scorecard.initializeScorecard(DEMO_PROJECT_UUID, ratingSystem.id, null);

    // 3. Apply curated awards (idempotent; skips user-edited rows).
    let applied = 0;
    for (const [slug, points] of Object.entries(DEMO_AWARDS)) {
      const credit = await this.credits.findOne({ where: { slug } });
      if (!credit) continue;
      const entry = await this.entries.findOne({
        where: { projectId: DEMO_PROJECT_UUID, creditId: credit.id },
      });
      if (!entry || entry.updatedBy !== null) continue; // user edited → leave alone

      let selectedTierId: string | null = null;
      const tierRows = await this.tiers.find({ where: { creditId: credit.id } });
      if (tierRows.length > 0) {
        const tier = tierRows.find((t) => t.points === points) ?? tierRows[0];
        selectedTierId = tier.id;
      }

      entry.attempted = true;
      entry.attemptedPoints = points;
      entry.verifiedPoints = points;
      entry.awardedPoints = points;
      entry.selectedPointValueId = selectedTierId;
      await this.entries.save(entry);
      applied += 1;
    }

    this.logger.log(
      `Demo project ${DEMO_PROJECT_UUID} seeded — ${applied} curated credits (Silver band).`,
    );
  }
}
