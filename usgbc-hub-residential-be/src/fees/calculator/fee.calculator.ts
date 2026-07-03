/**
 * Pure fee calculator (BR-F1, FL-1). No Nest imports, no I/O. The caller
 * resolves the effective schedule and passes it in, keeping this deterministic
 * and property-testable.
 */

export type MembershipLevelValue = 'USGBC_MEMBER' | 'NON_MEMBER';

export interface FeeScheduleEntry {
  id: string;
  ratingSystemSlug: string;
  membershipLevel: MembershipLevelValue;
  amountCents: number;
  currency: string;
}

export interface FeeInput {
  ratingSystemSlug: string;
  membershipLevel: MembershipLevelValue;
  schedule: FeeScheduleEntry[];
}

export interface FeeLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface FeeWarning {
  reason: 'no_fee_schedule_match';
}

export interface FeeQuote {
  amountCents: number;
  currency: string;
  lineItems: FeeLineItem[];
  scheduleId: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  warnings: FeeWarning[];
}

export function compute(input: FeeInput): FeeQuote {
  const match = input.schedule.find(
    (s) =>
      s.ratingSystemSlug === input.ratingSystemSlug &&
      s.membershipLevel === input.membershipLevel,
  );

  if (!match) {
    return {
      amountCents: 0,
      currency: 'USD',
      lineItems: [],
      scheduleId: null,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      warnings: [{ reason: 'no_fee_schedule_match' }],
    };
  }

  const lineItem: FeeLineItem = {
    description: `LEED registration fee (${input.membershipLevel === 'USGBC_MEMBER' ? 'USGBC member' : 'non-member'})`,
    quantity: 1,
    unitPriceCents: match.amountCents,
    totalCents: match.amountCents,
  };

  return {
    amountCents: match.amountCents,
    currency: match.currency,
    lineItems: [lineItem],
    scheduleId: match.id,
    subtotalCents: match.amountCents,
    taxCents: 0,
    totalCents: match.amountCents,
    warnings: [],
  };
}
