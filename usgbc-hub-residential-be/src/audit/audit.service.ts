import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';
import { RequestContextService } from '../common/request-context/request-context.service';

export interface RecordAuditInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  /** Overrides the request-context actor (e.g., system events pass null). */
  actorUserId?: string | null;
}

/**
 * Append-only audit-log writer (BR-X3). Other units call `record(...)` to log
 * status/state/score/note changes. There is no update/delete surface.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly context: RequestContextService,
  ) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    const actorUserId =
      input.actorUserId !== undefined ? input.actorUserId : this.context.actorUserId;
    const entry = this.repo.create({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
    });
    return this.repo.save(entry);
  }
}
