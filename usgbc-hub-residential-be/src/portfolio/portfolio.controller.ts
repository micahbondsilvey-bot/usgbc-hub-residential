import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { PortfolioFeeService } from './portfolio-fee.service';
import { PortfolioSubmissionOrchestrator } from './portfolio-submission.orchestrator';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ReviewPhase } from '../review/enums';
import { PatchAnchorDto, PatchParentAnchorDto, PortfolioSubmitDto } from './dto/portfolio.dto';

const ALL_ROLES = [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER];

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId', version: '1' })
@ProjectRoles(...ALL_ROLES)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly fees: PortfolioFeeService,
    private readonly submission: PortfolioSubmissionOrchestrator,
  ) {}

  @Patch('anchor')
  toggleAnchor(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: PatchAnchorDto,
  ) {
    return this.portfolio.toggleAnchor(projectId, dto.isPortfolioAnchor, user);
  }

  @Patch('parent-anchor')
  setParentAnchor(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: PatchParentAnchorDto,
  ) {
    return this.portfolio.setParentAnchor(projectId, dto.parentAnchorId ?? null, user);
  }

  @Get('portfolio')
  dashboard(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.portfolio.buildDashboard(projectId, user);
  }

  @Get('portfolio/fee-quote')
  feeQuote(@Param('projectId') projectId: string, @Query('phase') phase: string) {
    return this.fees.quote(projectId, this.parsePhase(phase));
  }

  @Post('portfolio/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: PortfolioSubmitDto,
  ) {
    return this.submission.submit(projectId, dto.phase, user);
  }

  @Post('portfolio/pay-and-submit')
  payAndSubmit(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: PortfolioSubmitDto,
  ) {
    return this.submission.payAndSubmit(projectId, dto.phase, user);
  }

  private parsePhase(value: string): ReviewPhase {
    const upper = (value ?? '').toUpperCase();
    if (upper in ReviewPhase) return ReviewPhase[upper as keyof typeof ReviewPhase];
    throw new BadRequestException('Invalid or missing phase');
  }
}
