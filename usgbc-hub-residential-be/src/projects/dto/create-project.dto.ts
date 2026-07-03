import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BuildingType, MembershipLevel, PaymentChoice } from '../enums';

/** Fields shared by draft + register (all optional at DRAFT, validated at register). */
export class ProjectFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ratingSystemId?: string;
  @ApiPropertyOptional({ enum: MembershipLevel }) @IsOptional() @IsEnum(MembershipLevel)
  membershipLevel?: MembershipLevel;
  @ApiPropertyOptional({ enum: BuildingType }) @IsOptional() @IsEnum(BuildingType)
  buildingType?: BuildingType;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) numberOfUnits?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) grossArea?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetCertificationLevel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() ownerEmail?: string;
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

export class CreateProjectDto extends ProjectFieldsDto {
  @ApiProperty({ enum: ['draft', 'register'] })
  @IsIn(['draft', 'register'])
  mode!: 'draft' | 'register';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  draftProjectId?: string;

  @ApiPropertyOptional({ description: 'Alternative to ratingSystemId; resolved server-side.' })
  @IsOptional()
  @IsString()
  ratingSystemSlug?: string;

  @ApiPropertyOptional({ enum: PaymentChoice })
  @IsOptional()
  @IsEnum(PaymentChoice)
  paymentChoice?: PaymentChoice;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acceptedAgreementVersion?: string;
}
