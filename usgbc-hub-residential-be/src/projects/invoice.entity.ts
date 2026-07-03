import { Column, Entity, Index } from 'typeorm';
import { AuditBase } from '../audit/audit-base.entity';
import { InvoiceStatus, PaymentChoice } from './enums';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

/** One invoice per project this build (BR-I2). */
@Entity('invoices')
export class Invoice extends AuditBase {
  @Index('uq_invoice_project', { unique: true })
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  displayId!: string;

  @Column({ type: 'enum', enum: PaymentChoice })
  paymentChoice!: PaymentChoice;

  @Column({ type: 'enum', enum: InvoiceStatus })
  status!: InvoiceStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'int' })
  subtotalCents!: number;

  @Column({ type: 'int', default: 0 })
  taxCents!: number;

  @Column({ type: 'int' })
  totalCents!: number;

  @Column({ type: 'jsonb' })
  lineItems!: InvoiceLineItem[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentProviderRef!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'timestamptz' })
  generatedAt!: Date;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
