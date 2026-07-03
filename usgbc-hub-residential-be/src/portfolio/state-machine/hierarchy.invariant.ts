/**
 * Pure portfolio hierarchy invariant (BR-PA2/BR-PA6, FL-12). No Nest imports.
 * Anchors are roots (depth = 1): a child attaches directly to an anchor; no chains.
 */

export interface HierarchyCandidate {
  id: string;
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;
}

export type HierarchyError =
  | 'HIERARCHY_SELF_PARENT'
  | 'HIERARCHY_TARGET_NOT_ANCHOR'
  | 'HIERARCHY_DEPTH_EXCEEDED'
  | 'HIERARCHY_ANCHOR_CANNOT_BE_CHILD';

export function assertHierarchy(
  child: HierarchyCandidate,
  candidateAnchor: HierarchyCandidate | null,
): void {
  if (candidateAnchor === null) return; // detach is always legal at this layer
  if (candidateAnchor.id === child.id) {
    throw new Error('HIERARCHY_SELF_PARENT');
  }
  if (!candidateAnchor.isPortfolioAnchor) {
    throw new Error('HIERARCHY_TARGET_NOT_ANCHOR');
  }
  if (candidateAnchor.parentAnchorId !== null) {
    throw new Error('HIERARCHY_DEPTH_EXCEEDED');
  }
  if (child.isPortfolioAnchor) {
    throw new Error('HIERARCHY_ANCHOR_CANNOT_BE_CHILD');
  }
}
