import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { BuildingType, MembershipLevel, ProjectStatus } from './enums';

/** The top-level registered LEED v4.1 SF project (domain-entities.md). */
@Entity('projects')
export class Project extends AuditBase {
  @Index('uq_project_gbci_display_id', { unique: true, where: '"gbciDisplayId" IS NOT NULL' })
  @Column({ type: 'varchar', length: 40, nullable: true })
  gbciDisplayId!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sapProjectId!: string | null;

  @Column({ type: 'uuid' })
  ratingSystemId!: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status!: ProjectStatus;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: MembershipLevel, default: MembershipLevel.NON_MEMBER })
  membershipLevel!: MembershipLevel;

  @Column({ type: 'enum', enum: BuildingType, default: BuildingType.SINGLE_FAMILY_DETACHED })
  buildingType!: BuildingType;

  @Column({ type: 'int', default: 1 })
  numberOfUnits!: number;

  @Column({ type: 'int', nullable: true })
  grossArea!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  targetCertificationLevel!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  achievedCertificationLevel!: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentAnchorId!: string | null;

  @Column({ type: 'boolean', default: false })
  isPortfolioAnchor!: boolean;

  // Owner block
  @Column({ type: 'varchar', length: 200, nullable: true })
  ownerName!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  ownerEmail!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  ownerPhone!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ownerOrganization!: string | null;

  // Address block
  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine1!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine2!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'varchar', length: 2, default: 'US' })
  country!: string;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  registeredAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  registeredByUserId!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
