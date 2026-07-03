import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { Invoice } from './invoice.entity';
import { CertificationAgreement } from './certification-agreement.entity';
import { BuildingType, InvoiceStatus, MembershipLevel, PaymentChoice, ProjectStatus } from './enums';
import { CatalogService } from '../catalog/catalog.service';
import { AGREEMENT_TEXT_V1, AGREEMENT_VERSION_V1, hashAgreementText } from './agreement-text';
import { DEMO_PROJECT_UUID } from '../scorecard/demo.seeder';

const DEMO_REGISTERED_AT = new Date('2024-01-15T12:00:00Z');

/**
 * BL-6 — materialize a real Project row behind the Unit 2 demo placeholder id.
 * Uses a special display id below the live sequence floor so it never collides.
 * Idempotent: only fills a pristine (system-owned) row; never clobbers user edits.
 */
@Injectable()
export class ProjectsDemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(ProjectsDemoSeeder.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(CertificationAgreement)
    private readonly agreements: Repository<CertificationAgreement>,
    private readonly catalog: CatalogService,
  ) {}

  async onModuleInit(): Promise<void> {
    const ratingSystem = await this.catalog.getDefaultRatingSystem();

    const existing = await this.projects.findOne({ where: { id: DEMO_PROJECT_UUID } });
    if (existing && existing.createdBy !== null) {
      // A real user has taken over this row — leave it alone.
      return;
    }

    const project = existing ?? this.projects.create({ id: DEMO_PROJECT_UUID });
    project.gbciDisplayId = 'RES-100000';
    project.ratingSystemId = ratingSystem.id;
    project.status = ProjectStatus.REGISTERED;
    project.name = 'GBCI Demo Residential Project';
    project.membershipLevel = MembershipLevel.USGBC_MEMBER;
    project.buildingType = BuildingType.SINGLE_FAMILY_DETACHED;
    project.numberOfUnits = 1;
    project.grossArea = 2400;
    project.targetCertificationLevel = 'Silver';
    project.ownerName = 'Demo Owner';
    project.ownerEmail = 'owner@residential.test';
    project.ownerPhone = null;
    project.ownerOrganization = 'GBCI Demo Homes';
    project.addressLine1 = '2101 L Street NW';
    project.addressLine2 = 'Suite 500';
    project.city = 'Washington';
    project.region = 'DC';
    project.postalCode = '20037';
    project.country = 'US';
    project.registeredAt = DEMO_REGISTERED_AT;
    project.registeredByUserId = null;
    project.createdBy = null;
    project.updatedBy = null;
    await this.projects.save(project);

    await this.ensureDemoInvoice();
    await this.ensureDemoAgreement();

    this.logger.log(`Demo project row ensured (${project.gbciDisplayId}).`);
  }

  private async ensureDemoInvoice(): Promise<void> {
    const existing = await this.invoices.findOne({ where: { projectId: DEMO_PROJECT_UUID } });
    if (existing) return;
    const invoice = this.invoices.create({
      projectId: DEMO_PROJECT_UUID,
      displayId: 'INV-100000',
      paymentChoice: PaymentChoice.PAY_NOW,
      status: InvoiceStatus.PAID,
      currency: 'USD',
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      lineItems: [
        { description: 'Demo registration (no charge)', quantity: 1, unitPriceCents: 0, totalCents: 0 },
      ],
      paymentProviderRef: 'mock_intent_demo',
      paidAt: DEMO_REGISTERED_AT,
      generatedAt: DEMO_REGISTERED_AT,
      version: 1,
      createdBy: null,
      updatedBy: null,
    });
    await this.invoices.save(invoice);
  }

  private async ensureDemoAgreement(): Promise<void> {
    const existing = await this.agreements.findOne({ where: { projectId: DEMO_PROJECT_UUID } });
    if (existing) return;
    const agreement = this.agreements.create({
      projectId: DEMO_PROJECT_UUID,
      signedByUserId: DEMO_PROJECT_UUID, // synthetic system signer for the demo
      signedByName: 'GBCI Demo',
      signedAt: DEMO_REGISTERED_AT,
      agreementVersion: AGREEMENT_VERSION_V1,
      agreementTextHash: hashAgreementText(AGREEMENT_TEXT_V1),
      createdBy: null,
      updatedBy: null,
    });
    await this.agreements.save(agreement);
  }
}
