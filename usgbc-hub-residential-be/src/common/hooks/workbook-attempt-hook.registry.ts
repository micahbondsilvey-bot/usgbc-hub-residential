import { Injectable, Logger } from '@nestjs/common';

export interface AttemptChangeEvent {
  projectId: string;
  creditId: string;
  attempted: boolean;
  actorUserId: string | null;
}

export type AttemptChangeListener = (event: AttemptChangeEvent) => void | Promise<void>;

/**
 * Neutral pub/sub seam (BR-WX2) that lets ScorecardService notify the Workbook
 * of attempted-flag changes without a circular module dependency. Listener
 * exceptions are logged and swallowed — materialization is an enrichment, never
 * a precondition for the scorecard write.
 */
@Injectable()
export class WorkbookAttemptHookRegistry {
  private readonly logger = new Logger(WorkbookAttemptHookRegistry.name);
  private readonly listeners: AttemptChangeListener[] = [];

  register(listener: AttemptChangeListener): void {
    this.listeners.push(listener);
  }

  async notify(event: AttemptChangeEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        this.logger.warn(
          `Attempt-change listener failed for credit ${event.creditId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
