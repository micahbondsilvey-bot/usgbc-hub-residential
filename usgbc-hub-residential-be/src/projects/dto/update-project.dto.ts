import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BuildingType } from '../enums';

/**
 * Post-registration edits (BR-P5). Fee-related fields (membershipLevel) are
 * intentionally absent — attempting to change them is rejected at the service.
 */
export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: BuildingType }) @IsOptional() buildingType?: BuildingType;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) numberOfUnits?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) grossArea?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetCertificationLevel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerOrganization?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() latitude?: number;
  @ApiPropertyOptional() @IsOptional() longitude?: number;
}

export class WithdrawProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
