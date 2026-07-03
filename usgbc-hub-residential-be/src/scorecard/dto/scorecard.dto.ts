import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class ScorecardEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() projectId!: string;
  @ApiProperty() creditId!: string;
  @ApiProperty() attempted!: boolean;
  @ApiProperty() attemptedPoints!: number;
  @ApiProperty() verifiedPoints!: number;
  @ApiProperty() awardedPoints!: number;
  @ApiProperty({ nullable: true }) selectedPointValueId!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true }) notes!: string | null;
}

/** Partial update to a scorecard entry (BL-5). All fields optional. */
export class UpdateScorecardEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  attempted?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'attemptedPoints must be a non-negative integer' })
  attemptedPoints?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'verifiedPoints must be a non-negative integer' })
  verifiedPoints?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'awardedPoints must be a non-negative integer' })
  awardedPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  selectedPointValueId?: string;
}
