/**
 * Pure FE mirror of the backend ScorecardSummaryCalculator (Q6=A / BL-7).
 * Kept byte-for-byte equivalent in contract to
 * `usgbc-hub-residential-be/src/scorecard/calculator/scorecard-summary.calculator.ts`.
 * Backend is authoritative on persisted reads; this drives instant local feedback.
 */
import {
  CategorySummary,
  CertificationLevel,
  CreditCategoryDto,
  CreditDto,
  ScorecardEntryDto,
  ScorecardSummary,
} from '../../core/api/dto';

export function deriveCertificationLevel(
  awarded: number,
  levels: CertificationLevel[],
): string | null {
  const sorted = [...levels].sort((a, b) => a.minPoints - b.minPoints);
  let result: string | null = null;
  for (const level of sorted) {
    const max = level.maxPoints ?? Number.POSITIVE_INFINITY;
    if (awarded >= level.minPoints && awarded <= max) {
      result = level.name;
    }
  }
  return result;
}

export interface CalcCatalog {
  categories: CreditCategoryDto[];
  certificationLevels: CertificationLevel[];
}

export function compute(entries: ScorecardEntryDto[], catalog: CalcCatalog): ScorecardSummary {
  const credits: CreditDto[] = catalog.categories.flatMap((c) => c.credits);
  const creditById = new Map(credits.map((c) => [c.id, c]));
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));

  const perCategoryMap = new Map<string, CategorySummary>();
  const ensure = (categoryId: string): CategorySummary => {
    let s = perCategoryMap.get(categoryId);
    if (!s) {
      const cat = categoryById.get(categoryId);
      s = {
        categoryId,
        categorySlug: cat?.slug ?? '',
        name: cat?.name ?? '',
        attempted: 0,
        verified: 0,
        awarded: 0,
        attemptedPointsAvailable: 0,
        awardedPointsAvailable: 0,
      };
      perCategoryMap.set(categoryId, s);
    }
    return s;
  };

  for (const credit of credits) {
    if (credit.kind !== 'credit') continue;
    const s = ensure(credit.categoryId);
    s.awardedPointsAvailable += credit.pointsMax ?? 0;
    s.attemptedPointsAvailable += credit.pointsMax ?? 0;
  }

  for (const entry of entries) {
    if (!entry.attempted) continue;
    const credit = creditById.get(entry.creditId);
    if (!credit) continue;
    const s = ensure(credit.categoryId);
    s.attempted += entry.attemptedPoints;
    s.verified += entry.verifiedPoints;
    s.awarded += entry.awardedPoints;
  }

  const perCategory = [...perCategoryMap.values()].sort((a, b) => {
    const ao = categoryById.get(a.categoryId)?.displayOrder ?? 0;
    const bo = categoryById.get(b.categoryId)?.displayOrder ?? 0;
    return ao - bo;
  });

  const overall = perCategory.reduce(
    (acc, c) => ({
      attempted: acc.attempted + c.attempted,
      verified: acc.verified + c.verified,
      awarded: acc.awarded + c.awarded,
      totalAvailable: acc.totalAvailable + c.awardedPointsAvailable,
    }),
    { attempted: 0, verified: 0, awarded: 0, totalAvailable: 0 },
  );

  return {
    perCategory,
    overall,
    certificationLevel: deriveCertificationLevel(overall.awarded, catalog.certificationLevels),
  };
}
