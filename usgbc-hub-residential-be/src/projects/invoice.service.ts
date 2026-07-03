import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Invoice, InvoiceLineItem } from './invoice.entity';
import { InvoiceStatus, PaymentChoice } from './enums';
import { PaymentProvider } from './payment.provider';
import { FeeQuote } from '../fees/calculator/fee.calculator';

export interface GenerateInvoiceInput {
  projectId: string;
  quote: FeeQuote;
  paymentChoice: PaymentChoice;
  actorUserId: string | null;
}

/** Invoice generation + display-id issuance (BR-I). */
@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice) private readonly repo: Repository<Invoice>,
    private readonly payment: PaymentProvider,
  ) {}

  /** Generate the (single) invoice for a project inside a transaction (BL-1 step 5). */
  async generate(manager: EntityManager, input: GenerateInvoiceInput): Promise<Invoice> {
    const existing = await manager.findOne(Invoice, { where: { projectId: input.projectId } });
    if (existing) throw new ConflictException('An invoice already exists for this project');

    this.assertTotals(input.quote);

    const seqRows = (await manager.query(
      "SELECT nextval('invoices_display_seq') AS n",
    )) as Array<{ n: string }>;
    const displayId = `INV-${seqRows[0]?.n}`;

    const invoice = manager.create(Invoice, {
      projectId: input.projectId,
      displayId,
      paymentChoice: input.paymentChoice,
      status: InvoiceStatus.UNPAID,
      currency: input.quote.currency,
      subtotalCents: input.quote.subtotalCents,
      taxCents: input.quote.taxCents,
      totalCents: input.quote.totalCents,
      lineItems: input.quote.lineItems as InvoiceLineItem[],
      paymentProviderRef: null,
      paidAt: null,
      generatedAt: new Date(),
      version: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    });

    if (input.paymentChoice === PaymentChoice.PAY_NOW) {
      const result = this.payment.recordPaymentIntent({
        amountCents: input.quote.totalCents,
        currency: input.quote.currency,
        projectId: input.projectId,
      });
      if (result.status !== 'succeeded') {
        throw new BadRequestException('Payment failed');
      }
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
      invoice.paymentProviderRef = result.providerRef;
    }

    return manager.save(invoice);
  }

  async findForProject(projectId: string): Promise<Invoice> {
    const invoice = await this.repo.findOne({ where: { projectId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private assertTotals(quote: FeeQuote): void {
    if (quote.subtotalCents + quote.taxCents !== quote.totalCents) {
      throw new BadRequestException('Invoice totals do not reconcile');
    }
    for (const line of quote.lineItems) {
      if (line.quantity * line.unitPriceCents !== line.totalCents) {
        throw new BadRequestException('Invoice line item total mismatch');
      }
    }
  }
}
