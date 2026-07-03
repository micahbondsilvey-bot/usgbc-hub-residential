import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminPipelineService } from './admin-pipeline.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ProjectStatus } from '../../projects/enums';
import { ReviewPhase } from '../../review/enums';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/pipeline', version: '1' })
export class AdminPipelineController {
  constructor(private readonly pipeline: AdminPipelineService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('phase') phase?: string,
    @Query('assignedReviewerId') assignedReviewerId?: string,
    @Query('gbciDisplayIdContains') gbciDisplayIdContains?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const take = limit ? Number.parseInt(limit, 10) : 50;
    return this.pipeline.list(
      user,
      {
        status: status as ProjectStatus | undefined,
        phase: phase as ReviewPhase | undefined,
        assignedReviewerId: assignedReviewerId || undefined,
        gbciDisplayIdContains: gbciDisplayIdContains || undefined,
      },
      Number.isFinite(take) ? take : 50,
      cursor,
    );
  }
}
