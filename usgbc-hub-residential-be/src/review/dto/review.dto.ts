import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ReviewOutcome, ReviewPhase } from '../enums';

export class SubmitReviewDto {
  @ApiProperty({ enum: ReviewPhase })
  @IsEnum(ReviewPhase)
  phase!: ReviewPhase;
}

export class AwardCreditDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  awardedPoints!: number;
}

export class ConfirmReviewDto {
  @ApiPropertyOptional({ enum: ReviewOutcome })
  @IsOptional()
  @IsEnum(ReviewOutcome)
  outcome?: ReviewOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportNotes?: string;
}

export class QualityScoreDto {
  @ApiProperty({ minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignReviewerDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}
