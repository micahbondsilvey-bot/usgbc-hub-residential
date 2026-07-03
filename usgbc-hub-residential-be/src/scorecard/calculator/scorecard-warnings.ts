/** Pure out-of-range warning computation (BR-S6). Values are never clamped. */

export type WarningColumn = 'attempted' | 'verified' | 'awarded';

export interface ScorecardWarning {
  creditId: string;
  column: WarningColumn;
  value: number;
  allowedMin: number;
  allowedMax: number;
  reason: 'value_out_of_credit_range';
}

export interface WarnableEntry {
  creditId: string;
  attempted: boolean;
  attemptedPoints: number;
  verifiedPoints: number;
  awardedPoints: number;
}

export interface WarnableCredit {
  id: string;
  kind: 'prerequisite' | 'credit';
  pointsMin: number | null;
  pointsMax: number | null;
}

/** Emit a warning for any attempted-entry column outside its credit's range. */
export function computeWarnings(
  entries: WarnableEntry[],
  credits: WarnableCredit[],
): ScorecardWarning[] {
  const creditById = new Map(credits.map((c) => [c.id, c]));
  const warnings: ScorecardWarning[] = [];

  for (const entry of entries) {
    if (!entry.attempted) continue;
    const credit = creditById.get(entry.creditId);
    if (!credit || credit.kind !== 'credit') continue;
    const min = credit.pointsMin ?? 0;
    const max = credit.pointsMax ?? 0;

    const columns: Array<[WarningColumn, number]> = [
      ['attempted', entry.attemptedPoints],
      ['verified', entry.verifiedPoints],
      ['awarded', entry.awardedPoints],
    ];
    for (const [column, value] of columns) {
      if (value < min || value > max) {
        warnings.push({
          creditId: entry.creditId,
          column,
          value,
          allowedMin: min,
          allowedMax: max,
          reason: 'value_out_of_credit_range',
        });
      }
    }
  }
  return warnings;
}
