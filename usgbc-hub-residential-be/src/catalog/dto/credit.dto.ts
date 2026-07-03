import { ApiProperty } from '@nestjs/swagger';
import { CreditKind } from '../credit.entity';

export class CreditPointValueDto {
  @ApiProperty() id!: string;
  @ApiProperty() tierLabel!: string;
  @ApiProperty() points!: number;
  @ApiProperty() displayOrder!: number;
}

export class CreditDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['prerequisite', 'credit'] }) kind!: CreditKind;
  @ApiProperty({ nullable: true }) pointsMin!: number | null;
  @ApiProperty({ nullable: true }) pointsMax!: number | null;
  @ApiProperty({ nullable: true }) intent!: string | null;
  @ApiProperty({ nullable: true }) requirementsSummary!: string | null;
  @ApiProperty({ nullable: true }) referenceGuideUrl!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ type: [CreditPointValueDto] }) pointValues!: CreditPointValueDto[];
}
