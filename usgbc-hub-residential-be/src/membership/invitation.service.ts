import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { Invitation, InvitationState, TERMINAL_INVITATION_STATES } from './invitation.entity';
import { MembershipService } from './membership.service';
import { UsersService } from '../users/users.service';
import { OneTimeTokenService } from '../common/tokens/one-time-token.service';
import { ExpiryService } from '../common/expiry/expiry.service';
import { NotificationGateway } from '../common/notifications-stub/notification.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationKind } from '../notifications/enums/notification.enums';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  CreateInvitationDto,
  InvitationPreviewDto,
} from './dto/invitation.dto';

const BCRYPT_COST = 10;

@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(Invitation) private readonly repo: Repository<Invitation>,
    private readonly membership: MembershipService,
    private readonly users: UsersService,
    private readonly tokens: OneTimeTokenService,
    private readonly expiry: ExpiryService,
    private readonly notifications: NotificationGateway,
    private readonly notificationFramework: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Create an invitation, enforcing who-may-invite-which-role (BR-I1, BR-I2). */
  async invite(
    actor: AuthUser,
    projectId: string,
    dto: CreateInvitationDto,
  ): Promise<{ id: string; state: InvitationState }> {
    await this.assertCanInvite(actor, projectId, dto.projectRole);

    const inviteeEmail = dto.inviteeEmail.trim().toLowerCase();

    // Supersede any existing PENDING invite for (projectId, inviteeEmail).
    const priorPending = await this.repo.findOne({
      where: { projectId, inviteeEmail, state: InvitationState.PENDING },
    });
    if (priorPending) {
      priorPending.state = InvitationState.REVOKED;
      priorPending.revokedAt = this.expiry.now();
      await this.repo.save(priorPending);
    }

    const ttl = this.config.get<string>('auth.invitationTtl', '7d');
    const { cleartext, hash } = this.tokens.generate();
    const invitation = this.repo.create({
      projectId,
      inviteeEmail,
      projectRole: dto.projectRole,
      tokenHash: hash,
      state: InvitationState.PENDING,
      expiresAt: this.expiry.expiryFrom(ttl),
      invitedBy: actor.id,
    });
    const saved = await this.repo.save(invitation);

    this.notifications.send({
      channel: 'email',
      to: inviteeEmail,
      subject: 'You have been invited to a USGBC Hub project',
      body: `You were invited as ${dto.projectRole}. Accept with this token: ${cleartext}`,
      meta: { token: cleartext, projectId, invitationId: saved.id },
    });

    const existingUser = await this.users.findByEmail(inviteeEmail);
    await this.notificationFramework.fire(
      {
        kind: NotificationKind.INVITATION_SENT,
        context: {
          projectId,
          invitationId: saved.id,
          projectRole: dto.projectRole,
          expiresAt: saved.expiresAt.toISOString(),
        },
      },
      existingUser
        ? { resolvedUsers: { invitee: { userId: existingUser.id, email: existingUser.email } } }
        : {},
    );

    return { id: saved.id, state: saved.state };
  }

  private async assertCanInvite(
    actor: AuthUser,
    projectId: string,
    role: ProjectRole,
  ): Promise<void> {
    if (actor.globalRole === GlobalRole.ADMIN) return; // Admin may invite any role.

    if (role === ProjectRole.REVIEWER) {
      throw new ForbiddenException('Reviewer invitations are Admin-only');
    }
    const actorRole = await this.membership.resolveActiveRole(actor.id, projectId);
    const canInvite =
      actorRole === ProjectRole.PROJECT_TEAM || actorRole === ProjectRole.GREEN_RATER;
    if (!canInvite) {
      throw new ForbiddenException('Only Project Team or Green Rater members may invite');
    }
  }

  async preview(cleartextToken: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findByToken(cleartextToken);
    if (!invitation) throw new NotFoundException('Invitation not found');
    const account = await this.users.findByEmail(invitation.inviteeEmail);
    return {
      projectId: invitation.projectId,
      inviteeEmail: invitation.inviteeEmail,
      projectRole: invitation.projectRole,
      state: invitation.state,
      expiresAt: invitation.expiresAt,
      accountExists: !!account,
    };
  }

  /** Accept an invitation (BR-I3/BR-I4). Creates an account on the fly if needed. */
  async accept(
    cleartextToken: string,
    actor: AuthUser | null,
    newPassword?: string,
    name?: string,
  ): Promise<{ projectId: string; projectRole: ProjectRole }> {
    const invitation = await this.findByToken(cleartextToken);
    if (!invitation) throw new UnauthorizedException('Invalid invitation token');

    // Lazy expiry (NFR Design Q3=A): flip to EXPIRED if past due, then reject.
    if (
      invitation.state === InvitationState.PENDING &&
      this.expiry.isExpired(invitation.expiresAt)
    ) {
      invitation.state = InvitationState.EXPIRED;
      await this.repo.save(invitation);
    }
    if (invitation.state !== InvitationState.PENDING) {
      throw new GoneException(`Invitation is ${invitation.state.toLowerCase()}`);
    }

    // Resolve the accepting user: existing account, current actor, or new account.
    let userId: string;
    const existing = await this.users.findByEmail(invitation.inviteeEmail);
    if (existing) {
      if (actor && actor.id !== existing.id) {
        throw new ForbiddenException('Invitation belongs to a different account');
      }
      userId = existing.id;
    } else {
      if (!newPassword) {
        throw new BadRequestException('A password is required to create the invited account');
      }
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      const created = await this.users.createLocalUser(
        invitation.inviteeEmail,
        passwordHash,
        true,
      );
      if (name) {
        await this.users.updateProfile(created.id, { name });
      }
      userId = created.id;
    }

    const now = this.expiry.now();
    await this.membership.createActiveMembership(
      userId,
      invitation.projectId,
      invitation.projectRole,
      invitation.invitedBy,
      now,
    );

    invitation.state = InvitationState.ACCEPTED;
    invitation.acceptedAt = now;
    invitation.acceptedByUserId = userId;
    await this.repo.save(invitation);

    return { projectId: invitation.projectId, projectRole: invitation.projectRole };
  }

  async decline(cleartextToken: string): Promise<void> {
    const invitation = await this.findByToken(cleartextToken);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (TERMINAL_INVITATION_STATES.has(invitation.state)) return; // idempotent
    invitation.state = InvitationState.DECLINED;
    invitation.declinedAt = this.expiry.now();
    await this.repo.save(invitation);
  }

  /** Revoke a PENDING invite — inviter or Admin only (BR-I2). Idempotent on terminal. */
  async revoke(actor: AuthUser, projectId: string, invitationId: string): Promise<void> {
    const invitation = await this.repo.findOne({ where: { id: invitationId, projectId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (TERMINAL_INVITATION_STATES.has(invitation.state)) return; // no-op

    const isInviter = invitation.invitedBy === actor.id;
    const isAdmin = actor.globalRole === GlobalRole.ADMIN;
    if (!isInviter && !isAdmin) {
      throw new ForbiddenException('Only the inviter or an Admin may revoke this invitation');
    }
    invitation.state = InvitationState.REVOKED;
    invitation.revokedAt = this.expiry.now();
    await this.repo.save(invitation);
  }

  /** System tick: expire all past-due PENDING invitations (BR-I2). */
  async expireDue(): Promise<number> {
    const now = this.expiry.now();
    const pending = await this.repo.find({ where: { state: InvitationState.PENDING } });
    let count = 0;
    for (const invite of pending) {
      if (this.expiry.isExpired(invite.expiresAt, now)) {
        invite.state = InvitationState.EXPIRED;
        await this.repo.save(invite);
        count += 1;
      }
    }
    return count;
  }

  private async findByToken(cleartextToken: string): Promise<Invitation | null> {
    const hash = this.tokens.hash(cleartextToken);
    return this.repo.findOne({ where: { tokenHash: hash } });
  }
}
