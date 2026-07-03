import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { ProfileDto } from './dto/profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GlobalRole } from '../auth/enums/role.enum';
import { AuditStampHelper } from '../audit/audit-stamp.helper';
import type { SeedUser } from '../config/configuration';

const BCRYPT_COST = 10;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly config: ConfigService,
    private readonly auditStamp: AuditStampHelper,
  ) {}

  /** Idempotent demo seed on startup (BR-S1/BR-S2, US-1.4). */
  async onModuleInit(): Promise<void> {
    const seedUsers = this.config.get<SeedUser[]>('seed.users', []);
    for (const seed of seedUsers) {
      await this.upsertSeedUser(seed);
    }
    if (seedUsers.length > 0) {
      this.logger.log(`Demo seed reconciled ${seedUsers.length} user(s).`);
    }
  }

  private async upsertSeedUser(seed: SeedUser): Promise<void> {
    const globalRole = seed.globalRole === 'admin' ? GlobalRole.ADMIN : GlobalRole.USER;
    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_COST);
    const existing = await this.repo.findOne({
      where: { email: seed.email },
      select: { id: true, email: true },
    });
    if (existing) {
      await this.repo.update(
        { id: existing.id },
        { passwordHash, globalRole, updatedBy: null },
      );
    } else {
      const entity = this.auditStamp.stampCreate(
        this.repo.create({
          email: seed.email,
          passwordHash,
          globalRole,
          emailVerifiedAt: new Date(),
        }),
        null,
      );
      await this.repo.save(entity);
    }
  }

  async findByEmail(email: string, withHash = false): Promise<User | null> {
    return this.repo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: withHash ? this.selectionWithHash() : undefined,
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async getProfileOrThrow(id: string): Promise<ProfileDto> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toProfile(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.organization !== undefined) user.organization = dto.organization;
    if (dto.greenRaterCredentialId !== undefined) {
      user.greenRaterCredentialId = dto.greenRaterCredentialId;
    }
    const saved = await this.repo.save(user);
    return this.toProfile(saved);
  }

  async recordLogin(id: string): Promise<void> {
    await this.repo.update({ id }, { lastLoginAt: new Date() });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id }, { passwordHash });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.repo.update({ id }, { emailVerifiedAt: new Date() });
  }

  /** Create a fresh USER account (used by invite-accept new-account flow, BR-I4). */
  async createLocalUser(email: string, passwordHash: string, verified = false): Promise<User> {
    const entity = this.repo.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      globalRole: GlobalRole.USER,
      emailVerifiedAt: verified ? new Date() : null,
    });
    return this.repo.save(entity);
  }

  toProfile(user: User): ProfileDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      greenRaterCredentialId: user.greenRaterCredentialId,
      globalRole: user.globalRole,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private selectionWithHash(): (keyof User)[] {
    return [
      'id',
      'email',
      'name',
      'organization',
      'greenRaterCredentialId',
      'passwordHash',
      'globalRole',
      'emailVerifiedAt',
      'lastLoginAt',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
    ];
  }
}
