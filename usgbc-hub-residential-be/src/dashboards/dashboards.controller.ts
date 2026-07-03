import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardsService } from './dashboards.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@ApiTags('dashboards')
@ApiBearerAuth()
@Controller({ path: 'dashboards', version: '1' })
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('project')
  project(@CurrentUser() user: AuthUser) {
    return this.dashboards.buildProjectDashboard(user);
  }

  @Get('green-rater')
  greenRater(@CurrentUser() user: AuthUser) {
    return this.dashboards.buildGreenRaterDashboard(user);
  }
}

@ApiTags('dashboards')
@ApiBearerAuth()
@Controller({ path: 'reviews', version: '1' })
export class ReviewerDashboardController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('assigned')
  assigned(@CurrentUser() user: AuthUser) {
    return this.dashboards.buildReviewerDashboard(user);
  }
}
