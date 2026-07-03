import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';

/** Per-project agreement signing record (US-2.1, BR-A). History retained. */
@Entity('certification_agreements')
export class CertificationAgreement extends AuditBase {
  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  signedByUserId!: string;

  @Column({ type: 'varchar', length: 200 })
  signedByName!: string;

  @Column({ type: 'timestamptz' })
  signedAt!: Date;

  @Column({ type: 'varchar', length: 20 })
  agreementVersion!: string;

  @Column({ type: 'varchar', length: 64 })
  agreementTextHash!: string;
}
