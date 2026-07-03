import { Injectable } from '@nestjs/common';
import { AuditBase } from './audit-base.entity';

/**
 * Explicit audit stamping for system-originated writes (Q2=B). When there is
 * no HTTP request actor (e.g., startup seeding, expiry ticks), callers use this
 * helper to set `createdBy`/`updatedBy` — typically to `null` per BR-X2, or to
 * a specific actor id when known.
 */
@Injectable()
export class AuditStampHelper {
  /** Stamp a freshly-constructed entity as a system (or specified-actor) create. */
  stampCreate<T extends Partial<AuditBase>>(entity: T, actorUserId: string | null = null): T {
    entity.createdBy = actorUserId;
    entity.updatedBy = actorUserId;
    return entity;
  }

  /** Stamp an entity being updated by the system (or a specified actor). */
  stampUpdate<T extends Partial<AuditBase>>(entity: T, actorUserId: string | null = null): T {
    entity.updatedBy = actorUserId;
    return entity;
  }
}
