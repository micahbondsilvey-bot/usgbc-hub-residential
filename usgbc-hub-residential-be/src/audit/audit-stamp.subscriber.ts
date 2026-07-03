import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { AuditBase } from './audit-base.entity';
import { RequestContextService } from '../common/request-context/request-context.service';

/**
 * Stamps `createdBy`/`updatedBy` on any AuditBase entity from the current
 * request actor (BR-X1/BR-X2). HTTP-originated mutations are covered here;
 * system-originated writes may pre-set values via AuditStampHelper (Q2=B),
 * in which case existing values are preserved.
 *
 * `createdAt`/`updatedAt` are handled by TypeORM's date columns.
 */
@Injectable()
@EventSubscriber()
export class AuditStampSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly context: RequestContextService,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<unknown>): void {
    const entity = event.entity as Partial<AuditBase> | undefined;
    if (!this.isAuditBase(entity)) return;
    const actor = this.context.actorUserId;
    if (entity.createdBy === undefined || entity.createdBy === null) {
      entity.createdBy = actor;
    }
    if (entity.updatedBy === undefined || entity.updatedBy === null) {
      entity.updatedBy = actor;
    }
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    const entity = event.entity as Partial<AuditBase> | undefined;
    if (!this.isAuditBase(entity)) return;
    // createdBy is immutable; only updatedBy is refreshed.
    entity.updatedBy = this.context.actorUserId;
  }

  private isAuditBase(entity: unknown): entity is Partial<AuditBase> {
    return (
      !!entity &&
      typeof entity === 'object' &&
      'createdBy' in (entity as Record<string, unknown>) &&
      'updatedBy' in (entity as Record<string, unknown>)
    );
  }
}
