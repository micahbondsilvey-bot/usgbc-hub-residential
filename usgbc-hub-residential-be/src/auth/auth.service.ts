import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LocalAuthService } from './local/local-auth.service';
import { LoginResponseDto } from './dto/login.dto';

/**
 * Authentication orchestration (BR-A1). Verifies credentials, records login,
 * and issues a token. Failures return a generic 401 with no enumeration.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly localAuth: LocalAuthService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(email, true);
    const genericError = new UnauthorizedException('Invalid email or password');
    if (!user || !user.passwordHash) throw genericError;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw genericError;

    await this.users.recordLogin(user.id);
    const accessToken = this.localAuth.sign({
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('auth.jwtExpiresIn', '8h'),
    };
  }
}
