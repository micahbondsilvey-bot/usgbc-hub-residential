import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Submittal } from './entities/submittal.entity';
import { SubmittalSlot } from './entities/submittal-slot.entity';
import { SubmittalSlotDefinition } from './entities/submittal-slot-definition.entity';
import {
  FILE_STORAGE_PROVIDER,
  FileStorageProvider,
} from './storage/file-storage.provider';
import { buildKey, sanitizeFileName } from './storage/key.utils';
import { StateLockService } from '../scorecard/state-lock.service';
import { MembershipService } from '../membership/membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { SubmittalDto } from './dto/workbook.dto';

const MAX_BYTES = 26_214_400; // 25 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'text/plain',
  'text/markdown',
]);

export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}

export interface FileStreamResult {
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
}

@Injectable()
export class SubmittalsOrchestrator {
  private readonly logger = new Logger(SubmittalsOrchestrator.name);

  constructor(
    @InjectRepository(Submittal) private readonly submittals: Repository<Submittal>,
    @InjectRepository(SubmittalSlot) private readonly slots: Repository<SubmittalSlot>,
    @InjectRepository(SubmittalSlotDefinition)
    private readonly slotDefs: Repository<SubmittalSlotDefinition>,
    @Inject(FILE_STORAGE_PROVIDER) private readonly storage: FileStorageProvider,
    private readonly stateLock: StateLockService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    projectId: string,
    creditId: string,
    slotKey: string,
    file: UploadFile,
    actor: AuthUser,
  ): Promise<SubmittalDto> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    await this.assertContributor(actor, projectId);

    if (!file) throw new BadRequestException('A file is required');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES || file.buffer.length > MAX_BYTES) {
      throw new PayloadTooLargeException('File exceeds the 25 MB limit');
    }

    const slotDef = await this.slotDefs.findOne({ where: { creditId, slotKey } });
    if (!slotDef) throw new NotFoundException('Submittal slot not found for this credit');

    const slot = await this.findOrCreateSlot(projectId, creditId, slotDef.id);
    if (!slotDef.multiUpload) {
      const existing = await this.submittals.count({
        where: { slotId: slot.id, archivedAt: IsNull() },
      });
      if (existing > 0) {
        throw new ConflictException('This slot already has a file; delete it before replacing.');
      }
    }

    const safeFileName = sanitizeFileName(file.originalname);
    const storageKey = buildKey(projectId, creditId, slotKey, safeFileName);
    await this.storage.put({
      key: storageKey,
      bytes: file.buffer,
      contentType: file.mimetype,
      contentLength: file.size,
    });

    try {
      const submittal = this.submittals.create({
        slotId: slot.id,
        projectId,
        creditId,
        originalFileName: file.originalname.slice(0, 260),
        safeFileName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        uploadedByUserId: actor.id,
        uploadedAt: new Date(),
        archivedAt: null,
      });
      const saved = await this.submittals.save(submittal);
      await this.audit.record({
        entityType: 'Submittal.uploaded',
        entityId: saved.id,
        action: AuditAction.CREATE,
        after: { storageKey, sizeBytes: saved.sizeBytes, mimeType: saved.mimeType },
      });
      return this.toDto(saved);
    } catch (err) {
      // Roll back the on-disk file so we don't accumulate orphans.
      await this.storage.delete(storageKey).catch(() => undefined);
      throw err;
    }
  }

  async delete(projectId: string, submittalId: string, actor: AuthUser): Promise<void> {
    await this.stateLock.assertWritable(projectId, { userId: actor.id, globalRole: actor.globalRole });
    const submittal = await this.submittals.findOne({ where: { id: submittalId, projectId } });
    if (!submittal) throw new NotFoundException('Submittal not found');

    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    const role = isAdmin ? null : await this.membership.resolveActiveRole(actor.id, projectId);
    const isUploader = submittal.uploadedByUserId === actor.id;
    const isContributor = role === ProjectRole.PROJECT_TEAM || role === ProjectRole.GREEN_RATER;
    if (!isAdmin && !isUploader && !isContributor) {
      throw new ForbiddenException('You may not delete this file');
    }

    await this.storage.delete(submittal.storageKey).catch(() => undefined);
    await this.submittals.remove(submittal);
    await this.audit.record({
      entityType: 'Submittal.deleted',
      entityId: submittalId,
      action: AuditAction.DELETE,
      before: { storageKey: submittal.storageKey },
    });
  }

  /** BL-6 — short-lived signed URL for download. */
  async createSignedUrl(
    projectId: string,
    submittalId: string,
    actor: AuthUser,
  ): Promise<{ url: string; expiresAt: string }> {
    await this.assertMember(actor, projectId);
    const submittal = await this.submittals.findOne({ where: { id: submittalId, projectId } });
    if (!submittal) throw new NotFoundException('Submittal not found');

    const secret = this.config.get<string>('auth.jwtSecret', 'change-me-in-real-envs');
    const token = jwt.sign({ submittalId, actorUserId: actor.id, type: 'file' }, secret, {
      expiresIn: '5m',
    });
    const base = 'http://localhost:3000/api/v1';
    return {
      url: `${base}/submittals/files/${token}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  async streamByToken(token: string): Promise<FileStreamResult> {
    const secret = this.config.get<string>('auth.jwtSecret', 'change-me-in-real-envs');
    let payload: { submittalId: string; type: string };
    try {
      payload = jwt.verify(token, secret) as { submittalId: string; type: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired file token');
    }
    if (payload.type !== 'file') throw new UnauthorizedException('Invalid file token');

    const submittal = await this.submittals.findOne({ where: { id: payload.submittalId } });
    if (!submittal) throw new NotFoundException('Submittal not found');
    const buffer = await this.storage.get(submittal.storageKey);
    return {
      buffer,
      mimeType: submittal.mimeType,
      originalFileName: submittal.originalFileName,
    };
  }

  private async findOrCreateSlot(
    projectId: string,
    creditId: string,
    slotDefinitionId: string,
  ): Promise<SubmittalSlot> {
    const existing = await this.slots.findOne({ where: { projectId, slotDefinitionId } });
    if (existing) {
      if (existing.archivedAt) {
        existing.archivedAt = null;
        existing.version += 1;
        return this.slots.save(existing);
      }
      return existing;
    }
    const slot = this.slots.create({
      projectId,
      creditId,
      slotDefinitionId,
      archivedAt: null,
      version: 1,
    });
    return this.slots.save(slot);
  }

  private async assertContributor(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (role !== ProjectRole.PROJECT_TEAM && role !== ProjectRole.GREEN_RATER) {
      throw new ForbiddenException('Only Project Team or Green Rater may upload files');
    }
  }

  private async assertMember(actor: AuthUser, projectId: string): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const role = await this.membership.resolveActiveRole(actor.id, projectId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }

  private toDto(s: Submittal): SubmittalDto {
    return {
      id: s.id,
      slotId: s.slotId,
      originalFileName: s.originalFileName,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      uploadedByUserId: s.uploadedByUserId,
      uploadedAt: s.uploadedAt,
    };
  }
}
