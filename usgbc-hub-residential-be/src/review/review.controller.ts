import { Body, Controller, Get, Header, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  AssignReviewerDto,
  AwardCreditDto,
  ConfirmReviewDto,
  QualityScoreDto,
  SubmitReviewDto,
} from './dto/review.dto';

const ALL_ROLES = [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER];

@ApiTags('reviews')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId', version: '1' })
@ProjectRoles(...ALL_ROLES)
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('reviews')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.reviews.list(projectId, user);
  }

  @Post('reviews')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviews.submit(projectId, dto.phase, user);
  }

  @Get('reviews/:reviewId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviews.get(projectId, reviewId, user);
  }

  @Get('reviews/:reviewId/report')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  report(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviews.getReport(projectId, reviewId, user);
  }

  @Put('reviews/:reviewId/credits/:creditId/award')
  award(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
    @Param('creditId') creditId: string,
    @Body() dto: AwardCreditDto,
  ) {
    return this.reviews.awardCredit(projectId, reviewId, creditId, dto.awardedPoints, user);
  }

  @Post('reviews/:reviewId/award-all-verified')
  awardAll(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviews.awardAllVerified(projectId, reviewId, user);
  }

  @Post('reviews/:reviewId/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ConfirmReviewDto,
  ) {
    return this.reviews.confirm(projectId, reviewId, dto, user);
  }

  @Post('reviews/:reviewId/return')
  returnReview(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviews.returnReview(projectId, reviewId, user);
  }

  @Put('reviews/:reviewId/quality-score')
  qualityScore(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: QualityScoreDto,
  ) {
    return this.reviews.upsertQualityScore(projectId, reviewId, dto.score, dto.notes ?? null, user);
  }

  @Get('quality-scores')
  qualityScores(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.reviews.listQualityScores(projectId, user);
  }

  @Post('accept')
  accept(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.reviews.accept(projectId, user);
  }

  @Post('continue-to-next-phase')
  continue(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.reviews.continueToNextPhase(projectId, user);
  }

  @Post('reviewers')
  assignReviewer(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: AssignReviewerDto,
  ) {
    return this.reviews.assignReviewer(projectId, dto.userId, user);
  }
}
