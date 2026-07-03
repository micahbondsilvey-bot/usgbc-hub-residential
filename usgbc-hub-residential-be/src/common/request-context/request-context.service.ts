import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  /** The authenticated actor's user id, or null for anonymous/system flows. */
  actorUserId: string | null;
  /** Correlation id for the current request (best-effort). */
  requestId?: string;
}

/**
 * AsyncLocalStorage-backed request context (NFR Design Q6=A).
 * Lets audit stamping and the audit-log writer discover the current actor
 * without threading it through every method signature.
 */
@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.als.run(store, callback);
  }

  get store(): RequestContextStore | undefined {
    return this.als.getStore();
  }

  get actorUserId(): string | null {
    return this.als.getStore()?.actorUserId ?? null;
  }

  setActor(userId: string | null): void {
    const store = this.als.getStore();
    if (store) store.actorUserId = userId;
  }
}
