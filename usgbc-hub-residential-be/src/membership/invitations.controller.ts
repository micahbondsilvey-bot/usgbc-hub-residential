import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InvitationService } from './invitation.service';
import { MembershipService } from './membership.service';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import { LocalAuthService } from '../auth/local/local-auth.service';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  DeclineInvitationDto,
  InvitationPreviewDto,
  MemberDto,
} from './dto/invitation.dto';

/** Project-scoped membership + invitation management. */
@ApiTags('memberships')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId', version: '1' })
export class ProjectMembershipController {
  constructor(
    private readonly invitations: InvitationService,
    private readonly membership: MembershipService,
  ) {}

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    // Fine-grained who-may-invite-which-role is enforced in the service (BR-I1).
    return this.invitations.invite(user, projectId, dto);
  }

  @Get('members')
  @ProjectRoles(ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER)
  @ApiOkResponse({ type: [MemberDto] })
  listMembers(@Param('projectId') projectId: string): Promise<MemberDto[]> {
    return this.membership.listMembers(projectId);
  }

  @Get('me-role')
  async myRole(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ): Promise<{ projectRole: ProjectRole | null }> {
    const projectRole = await this.membership.resolveActiveRole(user.id, projectId);
    return { projectRole };
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.invitations.revoke(user, projectId, id);
  }
}

/** Token-based invitation flows (public / optional-bearer landing pages). */
@ApiTags('invitations')
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationService,
    private readonly localAuth: LocalAuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get('preview')
  @ApiOkResponse({ type: InvitationPreviewDto })
  preview(@Query('token') token: string): Promise<InvitationPreviewDto> {
    return this.invitations.preview(token);
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60)
  async accept(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    const actor = await this.resolveOptionalActor(req);
    return this.invitations.accept(dto.token, actor, dto.newPassword, dto.name);
  }

  @Public()
  @Post('decline')
  @HttpCode(HttpStatus.OK)
  async decline(@Body() dto: DeclineInvitationDto): Promise<{ success: boolean }> {
    await this.invitations.decline(dto.token);
    return { success: true };
  }

  /** Resolve the caller from an optional bearer token (route is public). */
  private async resolveOptionalActor(req: Request): Promise<AuthUser | null> {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    try {
      const payload = this.localAuth.verify(value);
      const user = await this.users.findById(payload.sub);
      return user ? { id: user.id, email: user.email, globalRole: user.globalRole } : null;
    } catch {
      return null;
    }
  }
}
