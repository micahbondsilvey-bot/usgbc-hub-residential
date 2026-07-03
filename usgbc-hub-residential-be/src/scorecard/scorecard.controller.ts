import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ScorecardService } from './scorecard.service';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ScorecardDto } from './dto/scorecard-summary.dto';
import { ScorecardEntryDto, UpdateScorecardEntryDto } from './dto/scorecard.dto';

@ApiTags('scorecard')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/scorecard', version: '1' })
@ProjectRoles(ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER)
export class ScorecardController {
  constructor(private readonly scorecard: ScorecardService) {}

  @Get()
  @ApiOkResponse({ type: ScorecardDto })
  get(@Param('projectId') projectId: string): Promise<ScorecardDto> {
    return this.scorecard.getScorecard(projectId);
  }

  @Get('summary')
  getSummary(@Param('projectId') projectId: string) {
    return this.scorecard.getSummary(projectId);
  }

  @Put(':creditId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
    @Body() dto: UpdateScorecardEntryDto,
  ) {
    return this.scorecard.updateEntry(projectId, creditId, dto, user);
  }

  @Post(':creditId/un-attempt')
  @ApiOkResponse({ type: ScorecardEntryDto })
  unAttempt(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
  ): Promise<ScorecardEntryDto> {
    return this.scorecard.unAttempt(projectId, creditId, user);
  }
}
