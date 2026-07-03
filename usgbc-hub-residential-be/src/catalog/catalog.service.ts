import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatingSystem } from './rating-system.entity';
import { CreditCategory } from './credit-category.entity';
import { Credit } from './credit.entity';
import { CreditPointValue } from './credit-point-value.entity';
import { RatingSystemDto, RatingSystemSummaryDto } from './dto/rating-system.dto';
import { CalcCatalog } from '../scorecard/calculator/scorecard-summary.calculator';

/** Catalog read service with an in-memory cache (Q14=A). */
@Injectable()
export class CatalogService {
  private cacheById = new Map<string, RatingSystemDto>();

  constructor(
    @InjectRepository(RatingSystem) private readonly ratingSystems: Repository<RatingSystem>,
    @InjectRepository(CreditCategory) private readonly categories: Repository<CreditCategory>,
    @InjectRepository(Credit) private readonly credits: Repository<Credit>,
    @InjectRepository(CreditPointValue) private readonly tiers: Repository<CreditPointValue>,
  ) {}

  /** Clear the cache (called by the seeder after upserts). */
  invalidate(): void {
    this.cacheById.clear();
  }

  async listRatingSystems(): Promise<RatingSystemSummaryDto[]> {
    const rows = await this.ratingSystems.find({ order: { name: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      version: r.version,
      program: r.program,
      totalPointsAvailable: r.totalPointsAvailable,
    }));
  }

  async getRatingSystem(idOrSlug: string): Promise<RatingSystemDto> {
    const cached = this.cacheById.get(idOrSlug);
    if (cached) return cached;

    const rs = await this.resolveRatingSystem(idOrSlug);
    const categories = await this.categories.find({
      where: { ratingSystemId: rs.id },
      order: { displayOrder: 'ASC' },
    });
    const credits = await this.credits.find({
      where: categories.map((c) => ({ categoryId: c.id })),
      order: { displayOrder: 'ASC' },
    });
    const creditIds = credits.map((c) => c.id);
    const tiers = creditIds.length
      ? await this.tiers.find({
          where: creditIds.map((id) => ({ creditId: id })),
          order: { displayOrder: 'ASC' },
        })
      : [];

    const tiersByCredit = new Map<string, CreditPointValue[]>();
    for (const tier of tiers) {
      const list = tiersByCredit.get(tier.creditId) ?? [];
      list.push(tier);
      tiersByCredit.set(tier.creditId, list);
    }

    const dto: RatingSystemDto = {
      id: rs.id,
      slug: rs.slug,
      name: rs.name,
      version: rs.version,
      program: rs.program,
      totalPointsAvailable: rs.totalPointsAvailable,
      certificationLevels: rs.certificationLevels,
      categories: categories.map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        displayOrder: cat.displayOrder,
        iconRef: cat.iconRef,
        credits: credits
          .filter((c) => c.categoryId === cat.id)
          .map((c) => ({
            id: c.id,
            categoryId: c.categoryId,
            slug: c.slug,
            name: c.name,
            kind: c.kind,
            pointsMin: c.pointsMin,
            pointsMax: c.pointsMax,
            intent: c.intent,
            requirementsSummary: c.requirementsSummary,
            referenceGuideUrl: c.referenceGuideUrl,
            tags: c.tags ?? [],
            displayOrder: c.displayOrder,
            pointValues: (tiersByCredit.get(c.id) ?? []).map((t) => ({
              id: t.id,
              tierLabel: t.tierLabel,
              points: t.points,
              displayOrder: t.displayOrder,
            })),
          })),
      })),
    };

    this.cacheById.set(rs.id, dto);
    this.cacheById.set(rs.slug, dto);
    return dto;
  }

  /** Snapshot shaped for the pure summary calculator. */
  async getCalcCatalog(ratingSystemId: string): Promise<CalcCatalog> {
    const dto = await this.getRatingSystem(ratingSystemId);
    return {
      categories: dto.categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        displayOrder: c.displayOrder,
      })),
      credits: dto.categories.flatMap((cat) =>
        cat.credits.map((c) => ({
          id: c.id,
          categoryId: c.categoryId,
          kind: c.kind,
          pointsMax: c.pointsMax,
        })),
      ),
      certificationLevels: dto.certificationLevels,
    };
  }

  /** The default rating system for demo/registration flows. */
  async getDefaultRatingSystem(): Promise<RatingSystem> {
    return this.resolveRatingSystem('leed_v4_1_sf');
  }

  private async resolveRatingSystem(idOrSlug: string): Promise<RatingSystem> {
    const byId = await this.ratingSystems.findOne({ where: { id: idOrSlug } }).catch(() => null);
    const rs = byId ?? (await this.ratingSystems.findOne({ where: { slug: idOrSlug } }));
    if (!rs) throw new NotFoundException(`Rating system not found: ${idOrSlug}`);
    return rs;
  }
}
