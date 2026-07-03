import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FeeSchedule } from './fee-schedule.entity';
import { MembershipLevel } from '../projects/enums';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import { FeeScheduleEntry } from './calculator/fee.calculator';

interface SeedRow {
  ratingSystemSlug: string;
  membershipLevel: MembershipLevel;
  amountCents: number;
  currency: string;
  effectiveAt: string;
}

@Injectable()
export class FeeScheduleSeeder implements OnModuleInit {
  private readonly logger = new Logger(FeeScheduleSeeder.name);

  constructor(
    @InjectRepository(FeeSchedule) private readonly repo: Repository<FeeSchedule>,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  async onModuleInit(): Promise<void> {
    const path = join(process.cwd(), 'scripts', 'seed', 'fee-schedule.json');
    const rows = (JSON.parse(readFileSync(path, 'utf-8')) as { feeSchedules: SeedRow[] })
      .feeSchedules;

    this.validate(rows);

    for (const row of rows) {
      const existing = await this.repo.findOne({
        where: { ratingSystemSlug: row.ratingSystemSlug, membershipLevel: row.membershipLevel },
      });
      const entity = existing ?? this.repo.create();
      entity.ratingSystemSlug = row.ratingSystemSlug;
      entity.membershipLevel = row.membershipLevel;
      entity.amountCents = row.amountCents;
      entity.currency = row.currency;
      entity.effectiveAt = new Date(row.effectiveAt);
      entity.retiredAt = null;
      if (existing) this.auditStamp.stampUpdate(entity, null);
      else this.auditStamp.stampCreate(entity, null);
      await this.repo.save(entity);
    }
    this.logger.log(`Fee schedule seeded — ${rows.length} rows.`);
  }

  /** BR-F4 currency + FL-1 member<=non-member invariant, fail-fast. */
  private validate(rows: SeedRow[]): void {
    for (const row of rows) {
      if (row.currency !== 'USD') throw new Error('Fee schedule currency must be USD');
      if (row.amountCents < 0) throw new Error('Fee amountCents must be >= 0');
    }
    const bySlug = new Map<string, Partial<Record<MembershipLevel, number>>>();
    for (const row of rows) {
      const slot = bySlug.get(row.ratingSystemSlug) ?? {};
      slot[row.membershipLevel] = row.amountCents;
      bySlug.set(row.ratingSystemSlug, slot);
    }
    for (const [slug, amounts] of bySlug) {
      const member = amounts[MembershipLevel.USGBC_MEMBER];
      const nonMember = amounts[MembershipLevel.NON_MEMBER];
      if (member !== undefined && nonMember !== undefined && member > nonMember) {
        throw new Error(`Fee invariant violated for ${slug}: member fee exceeds non-member fee`);
      }
    }
  }

  /** BR-F2 — the effective schedule rows for a rating system. */
  async findEffective(ratingSystemSlug: string): Promise<FeeScheduleEntry[]> {
    const now = new Date();
    const rows = await this.repo.find({
      where: [
        { ratingSystemSlug, effectiveAt: LessThanOrEqual(now), retiredAt: IsNull() },
        { ratingSystemSlug, effectiveAt: LessThanOrEqual(now), retiredAt: MoreThan(now) },
      ],
    });
    return rows.map((r) => ({
      id: r.id,
      ratingSystemSlug: r.ratingSystemSlug,
      membershipLevel: r.membershipLevel,
      amountCents: r.amountCents,
      currency: r.currency,
    }));
  }
}
