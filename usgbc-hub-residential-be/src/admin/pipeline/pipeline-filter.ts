import { ProjectStatus } from '../../projects/enums';
import { ReviewPhase } from '../../review/enums';

/** Pure monotone pipeline filter (BR-AP2, FL-17). No I/O. */

export interface PipelineFilterInput {
  status?: ProjectStatus;
  phase?: ReviewPhase;
  assignedReviewerId?: string;
  gbciDisplayIdContains?: string;
}

export interface PipelineRowLike {
  status: ProjectStatus;
  gbciDisplayId: string | null;
  latestReview: { phase: ReviewPhase } | null;
  assignedReviewer: { userId: string } | null;
}

export function applyPipelineFilters<T extends PipelineRowLike>(
  rows: T[],
  filter: PipelineFilterInput,
): T[] {
  return rows.filter((row) => {
    if (filter.status && row.status !== filter.status) return false;
    if (filter.phase && row.latestReview?.phase !== filter.phase) return false;
    if (filter.assignedReviewerId && row.assignedReviewer?.userId !== filter.assignedReviewerId) {
      return false;
    }
    if (filter.gbciDisplayIdContains) {
      const needle = filter.gbciDisplayIdContains.toLowerCase();
      const hay = (row.gbciDisplayId ?? '').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
