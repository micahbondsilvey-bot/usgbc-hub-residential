import { ApiProperty } from '@nestjs/swagger';
import { CertificationLevel } from '../rating-system.entity';
import { CreditDto } from './credit.dto';

export class CreditCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ nullable: true }) iconRef!: string | null;
  @ApiProperty({ type: [CreditDto] }) credits!: CreditDto[];
}

export class RatingSystemDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() version!: string;
  @ApiProperty() program!: string;
  @ApiProperty() totalPointsAvailable!: number;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  certificationLevels!: CertificationLevel[];
  @ApiProperty({ type: [CreditCategoryDto] }) categories!: CreditCategoryDto[];
}

export class RatingSystemSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() version!: string;
  @ApiProperty() program!: string;
  @ApiProperty() totalPointsAvailable!: number;
}
