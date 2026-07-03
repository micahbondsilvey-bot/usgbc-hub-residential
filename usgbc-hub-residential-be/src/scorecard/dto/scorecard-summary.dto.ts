import { ApiProperty } from '@nestjs/swagger';
import { ScorecardEntryDto } from './scorecard.dto';
import { ScorecardWarning } from '../calculator/scorecard-warnings';
import { ScorecardSummary } from '../calculator/scorecard-summary.calculator';

export class WarningDto implements ScorecardWarning {
  @ApiProperty() creditId!: string;
  @ApiProperty({ enum: ['attempted', 'verified', 'awarded'] })
  column!: 'attempted' | 'verified' | 'awarded';
  @ApiProperty() value!: number;
  @ApiProperty() allowedMin!: number;
  @ApiProperty() allowedMax!: number;
  @ApiProperty() reason!: 'value_out_of_credit_range';
}

export class ScorecardDto {
  @ApiProperty({ type: [ScorecardEntryDto] })
  entries!: ScorecardEntryDto[];

  @ApiProperty({ type: 'object' })
  summary!: ScorecardSummary;

  @ApiProperty({ type: [WarningDto] })
  warnings!: ScorecardWarning[];
}
