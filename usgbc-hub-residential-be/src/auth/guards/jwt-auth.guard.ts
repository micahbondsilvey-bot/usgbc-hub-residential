import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { LocalAuthService } from '../local/local-auth.service';
import { UsersService } from '../../users/users.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import type { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Global authentication guard (BR-Z4). Verifies the bearer token, loads the
 * user fresh from the DB (so a revoked/disabled user cannot continue), attaches
 * `req.user`, and populates `RequestContext.actorUserId` for audit stamping.
 * Public routes are skipped via the @Public() decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly localAuth: LocalAuthService,
    private readonly users: UsersService,
    private readonly context: RequestContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const payload = this.localAuth.verify(token);
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
    };
    request.user = authUser;
    this.context.setActor(user.id);
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
