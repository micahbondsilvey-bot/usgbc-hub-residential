import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken } from './password-reset-token.entity';
import { UsersService } from '../../users/users.service';
import { OneTimeTokenService } from '../../common/tokens/one-time-token.service';
import { ExpiryService } from '../../common/expiry/expiry.service';
import { NotificationGateway } from '../../common/notifications-stub/notification.gateway';

const BCRYPT_COST = 10;

/**
 * Password reset flow (BR-A3). Responses are generic to prevent account
 * enumeration; the reset link is delivered via the mocked notification gateway.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken) private readonly repo: Repository<PasswordResetToken>,
    private readonly users: UsersService,
    private readonly tokens: OneTimeTokenService,
    private readonly expiry: ExpiryService,
    private readonly notifications: NotificationGateway,
    private readonly config: ConfigService,
  ) {}

  /** Always returns without revealing whether the email exists (BR-A3, BR-E1). */
  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      this.logger.debug('Password reset requested for unknown email (no-op).');
      return;
    }
    const ttl = this.config.get<string>('auth.passwordResetTtl', '1h');
    const { cleartext, hash } = this.tokens.generate();
    const entity = this.repo.create({
      userId: user.id,
      tokenHash: hash,
      expiresAt: this.expiry.expiryFrom(ttl),
      usedAt: null,
    });
    await this.repo.save(entity);
    this.notifications.send({
      channel: 'email',
      to: user.email,
      subject: 'Reset your USGBC Hub password',
      body: `Use this token to reset your password: ${cleartext}`,
      meta: { token: cleartext },
    });
  }

  /** Consume a token and set a new password. Single-use (BR-A3). */
  async confirm(cleartextToken: string, newPassword: string): Promise<void> {
    const now = this.expiry.now();
    const candidates = await this.repo.find({
      where: { usedAt: IsNull(), expiresAt: MoreThan(now) },
    });
    const match = candidates.find((t) => this.tokens.matches(cleartextToken, t.tokenHash));
    if (!match) throw new BadRequestException('Invalid or expired token');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.users.setPasswordHash(match.userId, passwordHash);
    match.usedAt = now;
    await this.repo.save(match);
  }
}
