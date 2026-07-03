import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationNote } from './entities/verification-note.entity';
import { NoteColumn } from './enums';
import { StateLockService } from '../scorecard/state-lock.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { VerificationNoteDto } from './dto/workbook.dto';

const MAX_BODY = 5000;

const COLUMN_WRITERS: Record<NoteColumn, ProjectRole[]> = {
  [NoteColumn.GREEN_RATER]: [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER],
  [NoteColumn.PROVIDER_QC]: [ProjectRole.GREEN_RATER],
  [NoteColumn.REVIEWER]: [ProjectRole.REVIEWER],
};

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(VerificationNote) private readonly repo: Repository<VerificationNote>,
    private readonly stateLock: StateLockService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
  ) {}

  async saveNote(
    projectId: string,
    creditId: string,
    column: NoteColumn,
    body: string | null,
    actor: AuthUser,
  ): Promise<VerificationNoteDto> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    await this.assertWriter(actor, projectId, column);
    if (body != null && body.length > MAX_BODY) {
      throw new BadRequestException(`Note exceeds ${MAX_BODY} characters`);
    }

    let row = await this.repo.findOne({ where: { projectId, creditId, column } });
    if (!row) {
      row = this.repo.create({ projectId, creditId, column, version: 1 });
    }
    const before = row.body;
    row.body = body ?? null;
    row.savedByUserId = actor.id;
    row.savedAt = new Date();
    row.version += 1;
    const saved = await this.repo.save(row);

    await this.audit.record({
      entityType: `VerificationNote.${column}`,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      before: { body: this.truncate(before) },
      after: { body: this.truncate(saved.body) },
    });

    return {
      creditId,
      column,
      body: saved.body,
      savedByUserId: saved.savedByUserId,
      savedAt: saved.savedAt,
      version: saved.version,
    };
  }

  private async assertWriter(
    actor: AuthUser,
    projectId: string,
    column: NoteColumn,
  ): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role || !COLUMN_WRITERS[column].includes(role)) {
      throw new ForbiddenException(`Your role may not write the ${column} note column`);
    }
  }

  private truncate(body: string | null): string | null {
    if (body == null) return null;
    return body.length > 240 ? `${body.slice(0, 240)}…` : body;
  }
}
