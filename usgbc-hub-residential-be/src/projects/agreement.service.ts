import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CertificationAgreement } from './certification-agreement.entity';
import { AGREEMENT_TEXT_V1, AGREEMENT_VERSION_V1, hashAgreementText } from './agreement-text';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

export interface SignAgreementContext {
  projectId: string;
  signedByUserId: string;
  signedByName: string;
  agreementVersion?: string;
}

/** Certification agreement signing (BL-5, BR-A). Name is snapshotted at signing. */
@Injectable()
export class AgreementService {
  constructor(
    @InjectRepository(CertificationAgreement)
    private readonly repo: Repository<CertificationAgreement>,
    private readonly users: UsersService,
  ) {}

  /** Create an agreement row within an existing transaction. */
  signWithinTransaction(
    manager: EntityManager,
    ctx: SignAgreementContext,
  ): Promise<CertificationAgreement> {
    const agreement = manager.create(CertificationAgreement, {
      projectId: ctx.projectId,
      signedByUserId: ctx.signedByUserId,
      signedByName: ctx.signedByName,
      signedAt: new Date(),
      agreementVersion: ctx.agreementVersion ?? AGREEMENT_VERSION_V1,
      agreementTextHash: hashAgreementText(AGREEMENT_TEXT_V1),
      createdBy: ctx.signedByUserId,
      updatedBy: ctx.signedByUserId,
    });
    return manager.save(agreement);
  }

  /** Standalone sign (outside the registration transaction). Snapshots the name. */
  async sign(projectId: string, actor: AuthUser): Promise<CertificationAgreement> {
    const user = await this.users.findById(actor.id);
    const agreement = this.repo.create({
      projectId,
      signedByUserId: actor.id,
      signedByName: user?.name ?? actor.email,
      signedAt: new Date(),
      agreementVersion: AGREEMENT_VERSION_V1,
      agreementTextHash: hashAgreementText(AGREEMENT_TEXT_V1),
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    return this.repo.save(agreement);
  }

  async getLatest(projectId: string): Promise<CertificationAgreement> {
    const rows = await this.repo.find({
      where: { projectId },
      order: { signedAt: 'DESC' },
      take: 1,
    });
    if (rows.length === 0) throw new NotFoundException('No agreement on file for this project');
    return rows[0];
  }

  get agreementText(): string {
    return AGREEMENT_TEXT_V1;
  }
}
