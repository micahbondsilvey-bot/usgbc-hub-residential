import { GlobalRole } from '../enums/role.enum';

/**
 * The authenticated principal attached to each request (req.user). Carries only
 * stable global identity — project roles are resolved per-request against
 * ProjectMembership (BR-A1/BR-Z4), never carried on the token.
 */
export interface AuthUser {
  id: string;
  email: string;
  globalRole: GlobalRole;
}

/** JWT payload shape (BR-A1). No project role is included. */
export interface JwtPayload {
  sub: string;
  email: string;
  globalRole: GlobalRole;
  iss?: string;
  iat?: number;
  exp?: number;
}
