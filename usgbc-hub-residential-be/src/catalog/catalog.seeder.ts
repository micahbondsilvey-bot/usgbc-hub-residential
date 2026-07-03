import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CertificationLevel, RatingSystem } from './rating-system.entity';
import { CreditCategory } from './credit-category.entity';
import { Credit, CreditKind } from './credit.entity';
import { CreditPointValue } from './credit-point-value.entity';
import { CatalogService } from './catalog.service';
import { AuditStampHelper } from '../audit/audit-stamp.helper';

interface SeedTier {
  tierLabel: string;
  points: number;
  displayOrder: number;
}
interface SeedCredit {
  slug: string;
  name: string;
  kind: CreditKind;
  pointsMin: number | null;
  pointsMax: number | null;
  intent?: string;
  requirementsSummary?: string;
  referenceGuideUrl?: string;
  tags?: string[];
  displayOrder: number;
  tiers?: SeedTier[];
}
interface SeedCategory {
  slug: string;
  name: string;
  displayOrder: number;
  iconRef?: string;
  credits: SeedCredit[];
}
interface SeedRatingSystem {
  slug: string;
  name: string;
  version: string;
  program: string;
  effectiveAt?: string;
  certificationLevels: CertificationLevel[];
  categories: SeedCategory[];
}
interface SeedFile {
  ratingSystems: SeedRatingSystem[];
}

/** Loads the hand-curated LEED catalog on startup (BR-C1/BR-C2, BL-1). Idempotent. */
@Injectable()
export class CatalogSeeder implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(
    @InjectRepository(RatingSystem) private readonly ratingSystems: Repository<RatingSystem>,
    @InjectRepository(CreditCategory) private readonly categories: Repository<CreditCategory>,
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(CreditPointValue) private readonly tiers: Repository<CreditPointValue>,
    private readonly catalog: CatalogService,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  async onModuleInit(): Promise<void> {
    const data = this.load();
    let categoryCount = 0;
    let creditCount = 0;
    let tierCount = 0;

    for (const rs of data.ratingSystems) {
      const totalPointsAvailable = this.validateAndTotal(rs);
      const ratingSystem = await this.upsertRatingSystem(rs, totalPointsAvailable);

      for (const cat of rs.categories) {
        const category = await this.upsertCategory(ratingSystem.id, cat);
        categoryCount += 1;
        for (const credit of cat.credits) {
          const savedCredit = await this.upsertCredit(category.id, credit);
          creditCount += 1;
          for (const tier of credit.tiers ?? []) {
            await this.upsertTier(savedCredit.id, tier);
            tierCount += 1;
          }
        }
      }
    }

    this.catalog.invalidate();
    this.logger.log(
      `Catalog seeded — ${categoryCount} categories, ${creditCount} credits, ${tierCount} tiers.`,
    );
  }

  private load(): SeedFile {
    const path = join(process.cwd(), 'scripts', 'seed', 'leed-v41-sf-catalog.json');
    return JSON.parse(readFileSync(path, 'utf-8')) as SeedFile;
  }

  /** BR-C3/BR-C4 validation; returns Σ pointsMax across kind='credit'. Fails fast. */
  private validateAndTotal(rs: SeedRatingSystem): number {
    let total = 0;
    for (const cat of rs.categories) {
      for (const c of cat.credits) {
        if (c.kind === 'credit') {
          const min = c.pointsMin ?? 0;
          const max = c.pointsMax ?? 0;
          if (min < 0 || max < min || max < 1) {
            throw new Error(`Invalid points for credit ${cat.slug}/${c.slug}`);
          }
          total += max;
        } else if ((c.pointsMax ?? 0) !== 0 || (c.pointsMin ?? 0) !== 0) {
          throw new Error(`Prerequisite ${cat.slug}/${c.slug} must have 0 points`);
        }
      }
    }
    this.validateCertificationLevels(rs.certificationLevels, total);
    return total;
  }

  private validateCertificationLevels(levels: CertificationLevel[], total: number): void {
    if (!levels.length) throw new Error('certificationLevels must be non-empty');
    const sorted = [...levels].sort((a, b) => a.minPoints - b.minPoints);
    for (let i = 0; i < sorted.length; i += 1) {
      const level = sorted[i];
      if (level.minPoints > total) {
        throw new Error(`Certification level ${level.name} minPoints exceeds total available`);
      }
      const isLast = i === sorted.length - 1;
      if (isLast) {
        if (level.maxPoints !== null) {
          throw new Error('Highest certification level must have maxPoints = null');
        }
      } else {
        const next = sorted[i + 1];
        if (level.maxPoints === null || next.minPoints !== level.maxPoints + 1) {
          throw new Error('Certification level ranges must be contiguous');
        }
      }
    }
  }

  private async upsertRatingSystem(
    rs: SeedRatingSystem,
    totalPointsAvailable: number,
  ): Promise<RatingSystem> {
    const existing = await this.ratingSystems.findOne({
      where: { version: rs.version, program: rs.program },
    });
    const base = existing ?? this.ratingSystems.create();
    base.slug = rs.slug;
    base.name = rs.name;
    base.version = rs.version;
    base.program = rs.program;
    base.totalPointsAvailable = totalPointsAvailable;
    base.certificationLevels = rs.certificationLevels;
    base.effectiveAt = rs.effectiveAt ? new Date(rs.effectiveAt) : null;
    base.retiredAt = null;
    this.stamp(base, !existing);
    return this.ratingSystems.save(base);
  }

  private async upsertCategory(
    ratingSystemId: string,
    cat: SeedCategory,
  ): Promise<CreditCategory> {
    const existing = await this.categories.findOne({
      where: { ratingSystemId, slug: cat.slug },
    });
    const base = existing ?? this.categories.create();
    base.ratingSystemId = ratingSystemId;
    base.slug = cat.slug;
    base.name = cat.name;
    base.displayOrder = cat.displayOrder;
    base.iconRef = cat.iconRef ?? null;
    this.stamp(base, !existing);
    return this.categories.save(base);
  }

  private async upsertCredit(categoryId: string, credit: SeedCredit): Promise<Credit> {
    const existing = await this.credits.findOne({
      where: { categoryId, slug: credit.slug },
    });
    const base = existing ?? this.credits.create();
    base.categoryId = categoryId;
    base.slug = credit.slug;
    base.name = credit.name;
    base.kind = credit.kind;
    base.pointsMin = credit.kind === 'prerequisite' ? 0 : credit.pointsMin ?? 0;
    base.pointsMax = credit.kind === 'prerequisite' ? 0 : credit.pointsMax ?? 0;
    base.intent = credit.intent ?? null;
    base.requirementsSummary = credit.requirementsSummary ?? null;
    base.referenceGuideUrl = credit.referenceGuideUrl ?? null;
    base.tags = credit.tags ?? [];
    base.displayOrder = credit.displayOrder;
    this.stamp(base, !existing);
    return this.credits.save(base);
  }

  private async upsertTier(creditId: string, tier: SeedTier): Promise<CreditPointValue> {
    const existing = await this.tiers.findOne({
      where: { creditId, tierLabel: tier.tierLabel },
    });
    const base = existing ?? this.tiers.create();
    base.creditId = creditId;
    base.tierLabel = tier.tierLabel;
    base.points = tier.points;
    base.displayOrder = tier.displayOrder;
    this.stamp(base, !existing);
    return this.tiers.save(base);
  }

  private stamp(entity: { createdBy: string | null; updatedBy: string | null }, isNew: boolean): void {
    if (isNew) this.auditStamp.stampCreate(entity, null);
    else this.auditStamp.stampUpdate(entity, null);
  }
}
