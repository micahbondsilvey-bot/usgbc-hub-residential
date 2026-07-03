import { ProjectStatus } from './enums';

/**
 * Pure project status state machine (BR-P3, FL-4). No Nest imports.
 * Returns true iff (from → to) is an allowed transition.
 */
const ALLOWED: ReadonlyArray<[ProjectStatus, ProjectStatus]> = [
  [ProjectStatus.DRAFT, ProjectStatus.REGISTERED],
  [ProjectStatus.REGISTERED, ProjectStatus.UNDER_REVIEW],
  [ProjectStatus.UNDER_REVIEW, ProjectStatus.CERTIFIED],
  [ProjectStatus.UNDER_REVIEW, ProjectStatus.DENIED],
  // Unit 5 extensions (BR-Z2): review return lifts the lock; accept from a passed review.
  [ProjectStatus.UNDER_REVIEW, ProjectStatus.REGISTERED],
  [ProjectStatus.REGISTERED, ProjectStatus.CERTIFIED],
  // Withdraw allowed from DRAFT or REGISTERED (BL-3 restricts to these).
  [ProjectStatus.DRAFT, ProjectStatus.WITHDRAWN],
  [ProjectStatus.REGISTERED, ProjectStatus.WITHDRAWN],
];

export function isAllowedTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return false;
  return ALLOWED.some(([f, t]) => f === from && t === to);
}
