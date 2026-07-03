import { ReviewStatus } from './enums';

/**
 * Pure review status state machine (BR-Z3, FL-10). No Nest imports.
 */
const ALLOWED: ReadonlyArray<[ReviewStatus, ReviewStatus]> = [
  [ReviewStatus.OPEN, ReviewStatus.SUBMITTED],
  [ReviewStatus.SUBMITTED, ReviewStatus.DECIDED],
  [ReviewStatus.SUBMITTED, ReviewStatus.CONFIRMED],
  [ReviewStatus.DECIDED, ReviewStatus.CONFIRMED],
  [ReviewStatus.CONFIRMED, ReviewStatus.RETURNED],
  // Re-submit path (BR-RW8): a returned review re-opens as submitted.
  [ReviewStatus.RETURNED, ReviewStatus.SUBMITTED],
];

export function isAllowedReviewTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return ALLOWED.some(([f, t]) => f === from && t === to);
}

export function assertReviewTransition(from: ReviewStatus, to: ReviewStatus): void {
  if (!isAllowedReviewTransition(from, to)) {
    throw new Error(`Illegal review transition: ${from} → ${to}`);
  }
}
