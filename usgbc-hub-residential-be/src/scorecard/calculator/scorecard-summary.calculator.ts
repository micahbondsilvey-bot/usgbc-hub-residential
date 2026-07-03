/**
 * Pure scorecard summary calculator (BL-7, Q12=A). No NestJS/DB dependencies.
 * The frontend mirrors this exact contract in
 * `usgbc-hub-residential-fe/src/app/features/scorecard/scorecard-summary.calc.ts`.
 *
 * PBT-01 properties (documented, tests deferred per Unit 1 deviation):
 *  - determinism, per-category sum invariant, available-points consistency,
 *    inclusion (non-attempted contribute 0), order independence, threshold
 *    partition, override permissiveness (sums not clamped).
 */

export interface CalcCertificationLevel {
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

export interface CalcCredit {
  id: string;
  categoryId: string;
  kind: 'prerequisite' | 'credit';
  pointsMax: number | null;
}

export interface CalcCategory {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
}

export interface CalcEntry {
  creditId: string;
  attempted: boolean;
  attemptedPoints: number;
  verifiedPoints: number;
  awardedPoints: number;
}

export interface CalcCatalog {
  categories: CalcCategory[];
  credits: CalcCredit[];
  certificationLevels: CalcCertificationLevel[];
}

export interface CategorySummary {
  categoryId: string;
  categorySlug: string;
  name: string;
  attempted: number;
  verified: number;
  awarded: number;
  attemptedPointsAvailable: number;
  awardedPointsAvailable: number;
}

export interface ScorecardSummary {
  perCategory: CategorySummary[];
  overall: { attempted: number; verified: number; awarded: number; totalAvailable: number };
  certificationLevel: string | null;
}

/** Returns the certification level name for an awarded total, or null (BL-7). */
export function deriveCertificationLevel(
  awarded: number,
  levels: CalcCertificationLevel[],
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

export function compute(entries: CalcEntry[], catalog: CalcCatalog): ScorecardSummary {
  const creditById = new Map(catalog.credits.map((c) => [c.id, c]));
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));

  const perCategoryMap = new Map<string, CategorySummary>();
  const ensureCategory = (categoryId: string): CategorySummary => {
    let summary = perCategoryMap.get(categoryId);
    if (!summary) {
      const category = categoryById.get(categoryId);
      summary = {
        categoryId,
        categorySlug: category?.slug ?? '',
        name: category?.name ?? '',
        attempted: 0,
        verified: 0,
        awarded: 0,
        attemptedPointsAvailable: 0,
        awardedPointsAvailable: 0,
      };
      perCategoryMap.set(categoryId, summary);
    }
    return summary;
  };

  // Available points per category = Σ pointsMax across kind='credit' credits.
  for (const credit of catalog.credits) {
    if (credit.kind !== 'credit') continue;
    const summary = ensureCategory(credit.categoryId);
    summary.awardedPointsAvailable += credit.pointsMax ?? 0;
    summary.attemptedPointsAvailable += credit.pointsMax ?? 0;
  }

  for (const entry of entries) {
    if (!entry.attempted) continue; // inclusion property
    const credit = creditById.get(entry.creditId);
    if (!credit) continue;
    const summary = ensureCategory(credit.categoryId);
    summary.attempted += entry.attemptedPoints;
    summary.verified += entry.verifiedPoints;
    summary.awarded += entry.awardedPoints;
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
