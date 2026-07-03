import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReviewPhase } from '../../review/enums';

export class PatchAnchorDto {
  @ApiProperty()
  @IsBoolean()
  isPortfolioAnchor!: boolean;
}

export class PatchParentAnchorDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parentAnchorId!: string | null;
}

export class PortfolioSubmitDto {
  @ApiProperty({ enum: ReviewPhase })
  @IsEnum(ReviewPhase)
  phase!: ReviewPhase;
}
