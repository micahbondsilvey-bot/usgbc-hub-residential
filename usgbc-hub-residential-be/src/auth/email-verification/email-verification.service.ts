import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EmailVerificationToken } from './email-verification-token.entity';
import { UsersService } from '../../users/users.service';
import { OneTimeTokenService } from '../../common/tokens/one-time-token.service';
import { ExpiryService } from '../../common/expiry/expiry.service';
import { NotificationGateway } from '../../common/notifications-stub/notification.gateway';

/** Email verification flow (BR-A4). One-time, time-bounded; informational only. */
@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repo: Repository<EmailVerificationToken>,
    private readonly users: UsersService,
    private readonly tokens: OneTimeTokenService,
    private readonly expiry: ExpiryService,
    private readonly notifications: NotificationGateway,
    private readonly config: ConfigService,
  ) {}

  async issue(userId: string, email: string): Promise<void> {
    const ttl = this.config.get<string>('auth.emailVerificationTtl', '7d');
    const { cleartext, hash } = this.tokens.generate();
    const entity = this.repo.create({
      userId,
      tokenHash: hash,
      expiresAt: this.expiry.expiryFrom(ttl),
      usedAt: null,
    });
    await this.repo.save(entity);
    this.notifications.send({
      channel: 'email',
      to: email,
      subject: 'Verify your USGBC Hub email',
      body: `Use this token to verify your email: ${cleartext}`,
      meta: { token: cleartext },
    });
  }

  async verify(cleartextToken: string): Promise<void> {
    const now = this.expiry.now();
    const candidates = await this.repo.find({
      where: { usedAt: IsNull(), expiresAt: MoreThan(now) },
    });
    const match = candidates.find((t) => this.tokens.matches(cleartextToken, t.tokenHash));
    if (!match) throw new BadRequestException('Invalid or expired token');
    await this.users.markEmailVerified(match.userId);
    match.usedAt = now;
    await this.repo.save(match);
  }
}
