import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class WorkbookFieldEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() creditId!: string;
  @ApiProperty() fieldDefinitionId!: string;
  @ApiProperty() fieldKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty() dataType!: string;
  @ApiProperty({ nullable: true }) unit!: string | null;
  @ApiProperty({ nullable: true }) areaTag!: string | null;
  @ApiProperty({ nullable: true }) helpText!: string | null;
  @ApiProperty({ type: [String], nullable: true }) enumOptions!: string[] | null;
  @ApiProperty() derived!: boolean;
  @ApiProperty() required!: boolean;
  @ApiProperty({ nullable: true }) value!: string | number | boolean | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty() version!: number;
}

export class SubmittalDto {
  @ApiProperty() id!: string;
  @ApiProperty() slotId!: string;
  @ApiProperty() originalFileName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() uploadedByUserId!: string;
  @ApiProperty() uploadedAt!: Date;
}

export class SubmittalSlotDto {
  @ApiProperty() id!: string;
  @ApiProperty() creditId!: string;
  @ApiProperty() slotDefinitionId!: string;
  @ApiProperty() slotKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true }) requirementNote!: string | null;
  @ApiProperty() required!: boolean;
  @ApiProperty() multiUpload!: boolean;
  @ApiProperty({ type: [SubmittalDto] }) files!: SubmittalDto[];
}

export class VerificationNoteDto {
  @ApiProperty() creditId!: string;
  @ApiProperty({ enum: ['GREEN_RATER', 'PROVIDER_QC', 'REVIEWER'] })
  column!: string;
  @ApiProperty({ nullable: true }) body!: string | null;
  @ApiProperty({ nullable: true }) savedByUserId!: string | null;
  @ApiProperty({ nullable: true }) savedAt!: Date | null;
  @ApiProperty() version!: number;
}

export class CreditWorkbookDto {
  @ApiProperty() creditId!: string;
  @ApiProperty({ type: [WorkbookFieldEntryDto] }) fieldEntries!: WorkbookFieldEntryDto[];
  @ApiProperty({ type: [SubmittalSlotDto] }) slots!: SubmittalSlotDto[];
  @ApiProperty({ type: [VerificationNoteDto] }) notes!: VerificationNoteDto[];
  @ApiProperty() hasFieldEntries!: boolean;
  @ApiProperty() hasSubmittals!: boolean;
  @ApiProperty() hasNotes!: boolean;
}

export class WorkbookDto {
  @ApiProperty({ type: [CreditWorkbookDto] }) credits!: CreditWorkbookDto[];
}

export class WriteFieldEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  value?: string | number | boolean | null;
}

export class WriteNoteDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  body?: string | null;
}
