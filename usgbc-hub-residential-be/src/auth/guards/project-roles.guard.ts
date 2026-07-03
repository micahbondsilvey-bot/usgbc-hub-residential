import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';
import { GlobalRole, ProjectRole } from '../enums/role.enum';
import { MembershipService } from '../../membership/membership.service';
import type { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Enforces the per-project authorization decision (BR-Z2/BR-Z3). Runs after
 * JwtAuthGuard. Routes opt in with @ProjectRoles(...) and must carry a
 * `:projectId` route param. Admin bypasses all project-role checks.
 */
@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membership: MembershipService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ProjectRole[] | undefined>(
      PROJECT_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    // No project-role requirement → route only needed authentication.
    if (!required || required.length === 0) return true;

    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // BR-Z2 step 1: Admin is universally allowed.
    if (user.globalRole === GlobalRole.ADMIN) return true;

    const projectId = request.params?.projectId;
    if (!projectId) throw new ForbiddenException('Missing project context');

    const role = await this.membership.resolveActiveRole(user.id, projectId);
    if (role && required.includes(role)) return true;

    throw new ForbiddenException('Insufficient project role');
  }
}
