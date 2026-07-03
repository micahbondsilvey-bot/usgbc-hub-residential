/**
 * Pure derived-field calculators (BR-WV3, FL-6). No Nest imports; deterministic.
 * Keyed by `formulaKey`. Unknown keys fall back to a no-op pass-through (null).
 */

export type FormulaValue = number | boolean | string | null;

export interface FormulaScope {
  /** Resolve a contributing field's current value by its fieldKey. */
  get(fieldKey: string): FormulaValue;
}

function num(value: FormulaValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export type FormulaFn = (scope: FormulaScope) => FormulaValue;

export const formulaRegistry: Record<string, FormulaFn> = {
  /** Compact development density = dwelling units / acres. */
  density_units_per_acre: (scope) => {
    const units = num(scope.get('lt_compact_units'));
    const acres = num(scope.get('lt_compact_acres'));
    if (units === null || acres === null || acres === 0) return null;
    return round6(units / acres);
  },

  /** Threshold-boolean: density meets the compact-development bar (≥ 7 units/acre). */
  density_meets_threshold: (scope) => {
    const density = num(scope.get('lt_compact_density_uph'));
    if (density === null) return null;
    return density >= 7;
  },
};

export function hasFormula(formulaKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(formulaRegistry, formulaKey);
}

export function runFormula(formulaKey: string, scope: FormulaScope): FormulaValue {
  const fn = formulaRegistry[formulaKey];
  return fn ? fn(scope) : null;
}
