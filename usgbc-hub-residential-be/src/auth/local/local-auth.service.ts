import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { GlobalRole } from '../enums/role.enum';
import type { JwtPayload } from '../interfaces/auth-user.interface';

/**
 * Local HS256 token issuer/verifier (BR-A1, tech-stack: jsonwebtoken HS256 8h).
 * The token carries stable identity only — no project role (BR-Z4).
 */
@Injectable()
export class LocalAuthService {
  constructor(private readonly config: ConfigService) {}

  sign(user: { id: string; email: string; globalRole: GlobalRole }): string {
    const secret = this.config.get<string>('auth.jwtSecret', 'change-me-in-real-envs');
    const expiresIn = this.config.get<string>('auth.jwtExpiresIn', '8h');
    const issuer = this.config.get<string>('auth.jwtIssuer', 'usgbc-hub-residential-be');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
    };
    return jwt.sign(payload, secret, { expiresIn, issuer } as jwt.SignOptions);
  }

  verify(token: string): JwtPayload {
    const secret = this.config.get<string>('auth.jwtSecret', 'change-me-in-real-envs');
    const issuer = this.config.get<string>('auth.jwtIssuer', 'usgbc-hub-residential-be');
    try {
      return jwt.verify(token, secret, { issuer }) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
