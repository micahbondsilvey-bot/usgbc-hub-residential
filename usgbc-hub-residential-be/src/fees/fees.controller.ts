import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeesService } from './fees.service';
import { MembershipLevel } from '../projects/enums';
import { FeeQuote } from './calculator/fee.calculator';

@ApiTags('registration')
@ApiBearerAuth()
@Controller({ path: 'registration', version: '1' })
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get('fee-quote')
  @ApiQuery({ name: 'ratingSystemSlug', required: true })
  @ApiQuery({ name: 'membershipLevel', enum: MembershipLevel, required: true })
  quote(
    @Query('ratingSystemSlug') ratingSystemSlug: string,
    @Query('membershipLevel') membershipLevel: string,
  ): Promise<FeeQuote> {
    if (!ratingSystemSlug) throw new BadRequestException('ratingSystemSlug is required');
    const level = this.normalizeLevel(membershipLevel);
    return this.fees.quote(ratingSystemSlug, level);
  }

  private normalizeLevel(value: string): MembershipLevel {
    const upper = (value ?? '').toUpperCase();
    if (upper === MembershipLevel.USGBC_MEMBER) return MembershipLevel.USGBC_MEMBER;
    if (upper === MembershipLevel.NON_MEMBER) return MembershipLevel.NON_MEMBER;
    throw new BadRequestException('membershipLevel must be USGBC_MEMBER or NON_MEMBER');
  }
}
