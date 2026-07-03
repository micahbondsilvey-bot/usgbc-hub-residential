import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { BulkRegistrationBatch } from './bulk-registration-batch.entity';
import { BulkRegistrationRow } from './bulk-registration-row.entity';
import { BulkRowStatus, BuildingType, MembershipLevel, PaymentChoice } from './enums';
import { BulkRegistrationParser, ParsedRow } from './bulk-registration.parser';
import { RegistrationOrchestrator } from './registration.orchestrator';
import { CreateProjectDto } from './dto/create-project.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

const MAX_ROWS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkRowOutcome {
  externalRowId: string;
  status: BulkRowStatus;
  projectId: string | null;
  errorMessage: string | null;
}

export interface BulkRegistrationSummary {
  batchId: string;
  totalRows: number;
  succeeded: number;
  failed: number;
  perRowOutcomes: BulkRowOutcome[];
}

/** BulkRegistrationOrchestrator (BL-4). Per-row commit; valid rows still process. */
@Injectable()
export class BulkRegistrationOrchestrator {
  private readonly logger = new Logger(BulkRegistrationOrchestrator.name);

  constructor(
    @InjectRepository(BulkRegistrationBatch)
    private readonly batches: Repository<BulkRegistrationBatch>,
    @InjectRepository(BulkRegistrationRow)
    private readonly rows: Repository<BulkRegistrationRow>,
    private readonly registration: RegistrationOrchestrator,
  ) {}

  async bulkRegister(
    file: { buffer: Buffer; originalname: string; size: number },
    actor: AuthUser,
  ): Promise<BulkRegistrationSummary> {
    const parsed = await BulkRegistrationParser.parseRows(file.buffer);
    if (parsed.length > MAX_ROWS) {
      throw new BadRequestException(`Too many rows (${parsed.length}); max is ${MAX_ROWS}`);
    }

    const batch = await this.batches.save(
      this.batches.create({
        uploaderUserId: actor.id,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        totalRows: parsed.length,
        succeededRows: 0,
        failedRows: 0,
        uploadedAt: new Date(),
        idempotencyHash: createHash('sha256').update(file.buffer).digest('hex'),
        createdBy: actor.id,
        updatedBy: actor.id,
      }),
    );

    const outcomes: BulkRowOutcome[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const row of parsed) {
      const outcome = await this.processRow(batch.id, row, actor);
      outcomes.push(outcome);
      if (outcome.status === BulkRowStatus.CREATED) succeeded += 1;
      else if (outcome.status === BulkRowStatus.FAILED) failed += 1;
    }

    batch.succeededRows = succeeded;
    batch.failedRows = failed;
    await this.batches.save(batch);

    return { batchId: batch.id, totalRows: parsed.length, succeeded, failed, perRowOutcomes: outcomes };
  }

  private async processRow(
    batchId: string,
    row: ParsedRow,
    actor: AuthUser,
  ): Promise<BulkRowOutcome> {
    const externalRowId = row.external_row_id;
    const rowEntity = this.rows.create({
      batchId,
      uploaderUserId: actor.id,
      externalRowId,
      status: BulkRowStatus.PENDING,
      projectId: null,
      errorMessage: null,
      rawRow: row,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    // Idempotency (BR-B3): a prior CREATED row short-circuits.
    const priorCreated = await this.rows.findOne({
      where: {
        uploaderUserId: actor.id,
        externalRowId,
        status: BulkRowStatus.CREATED,
      },
    });
    if (priorCreated) {
      rowEntity.status = BulkRowStatus.CREATED;
      rowEntity.projectId = priorCreated.projectId;
      await this.rows.save(rowEntity);
      return {
        externalRowId,
        status: BulkRowStatus.CREATED,
        projectId: priorCreated.projectId,
        errorMessage: null,
      };
    }

    const validationError = this.validateRow(row);
    if (validationError) {
      rowEntity.status = BulkRowStatus.FAILED;
      rowEntity.errorMessage = validationError;
      await this.rows.save(rowEntity);
      return { externalRowId, status: BulkRowStatus.FAILED, projectId: null, errorMessage: validationError };
    }

    try {
      const dto = this.rowToDto(row);
      const result = await this.registration.register(dto, actor);
      rowEntity.status = BulkRowStatus.CREATED;
      rowEntity.projectId = result.project.id;
      await this.rows.save(rowEntity);
      return {
        externalRowId,
        status: BulkRowStatus.CREATED,
        projectId: result.project.id,
        errorMessage: null,
      };
    } catch (err) {
      const message = (err as Error).message ?? 'Registration failed';
      rowEntity.status = BulkRowStatus.FAILED;
      rowEntity.errorMessage = message;
      await this.rows.save(rowEntity);
      return { externalRowId, status: BulkRowStatus.FAILED, projectId: null, errorMessage: message };
    }
  }

  private validateRow(row: ParsedRow): string | null {
    const required: Array<keyof ParsedRow> = [
      'external_row_id',
      'name',
      'rating_system_slug',
      'membership_level',
      'building_type',
      'gross_area',
      'owner_name',
      'owner_email',
      'address_line1',
      'city',
      'region',
      'postal_code',
      'country',
      'payment_choice',
    ];
    const missing = required.filter((k) => !row[k] || row[k].length === 0);
    if (missing.length > 0) return `Missing fields: ${missing.join(', ')}`;
    if (!EMAIL_RE.test(row.owner_email)) return 'Invalid owner_email';
    if (!this.isEnum(MembershipLevel, row.membership_level)) return 'Invalid membership_level';
    if (!this.isEnum(BuildingType, row.building_type)) return 'Invalid building_type';
    if (!this.isEnum(PaymentChoice, row.payment_choice)) return 'Invalid payment_choice';
    if (row.latitude && !this.inRange(row.latitude, -90, 90)) return 'latitude out of range';
    if (row.longitude && !this.inRange(row.longitude, -180, 180)) return 'longitude out of range';
    if (!/^[A-Z]{2}$/.test(row.country)) return 'country must be ISO alpha-2';
    return null;
  }

  private rowToDto(row: ParsedRow): CreateProjectDto {
    const dto = new CreateProjectDto();
    dto.mode = 'register';
    dto.name = row.name;
    // ratingSystemId resolution is deferred to a slug lookup in a future refinement;
    // for this build the seeded catalog exposes a single rating system by slug.
    dto.membershipLevel = row.membership_level as MembershipLevel;
    dto.buildingType = row.building_type as BuildingType;
    dto.numberOfUnits = row.number_of_units ? Number.parseInt(row.number_of_units, 10) : 1;
    dto.grossArea = row.gross_area ? Number.parseInt(row.gross_area, 10) : undefined;
    dto.targetCertificationLevel = row.target_certification_level || undefined;
    dto.ownerName = row.owner_name;
    dto.ownerEmail = row.owner_email;
    dto.ownerPhone = row.owner_phone || undefined;
    dto.ownerOrganization = row.owner_organization || undefined;
    dto.addressLine1 = row.address_line1;
    dto.addressLine2 = row.address_line2 || undefined;
    dto.city = row.city;
    dto.region = row.region;
    dto.postalCode = row.postal_code;
    dto.country = row.country;
    dto.latitude = row.latitude ? Number.parseFloat(row.latitude) : undefined;
    dto.longitude = row.longitude ? Number.parseFloat(row.longitude) : undefined;
    dto.paymentChoice = row.payment_choice as PaymentChoice;
    dto.acceptedAgreementVersion = 'v1.0-bulk';
    dto.ratingSystemSlug = row.rating_system_slug;
    return dto;
  }

  private isEnum(e: Record<string, string>, value: string): boolean {
    return Object.values(e).includes(value);
  }

  private inRange(value: string, min: number, max: number): boolean {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n >= min && n <= max;
  }
}
