import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Invoice } from '../projects/invoice.entity';
import { Project } from '../projects/project.entity';
import { CatalogService } from '../catalog/catalog.service';
import { FeesService } from '../fees/fees.service';
import { PortfolioService } from './portfolio.service';
import { ReviewPhase } from '../review/enums';

export interface PortfolioFeeLineItem {
  projectId: string;
  displayProjectId: string | null;
  registrationFeeCents: number;
  reviewFeeCents: number;
  totalCents: number;
  warnings: { reason: string }[];
}

export interface PortfolioFeeQuote {
  anchorProjectId: string;
  phase: ReviewPhase;
  lineItems: PortfolioFeeLineItem[];
  totals: {
    registrationFeeCents: number;
    reviewFeeCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  };
  warnings: { reason: string }[];
}

/** Pure-aggregation combined fee quote across a portfolio (BR-PF1). */
@Injectable()
export class PortfolioFeeService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    private readonly catalog: CatalogService,
    private readonly fees: FeesService,
    private readonly portfolio: PortfolioService,
  ) {}

  async quote(anchorId: string, phase: ReviewPhase): Promise<PortfolioFeeQuote> {
    const { anchor, children } = await this.portfolio.resolvePortfolio(anchorId);
    const projects: Project[] = [anchor, ...children];

    const lineItems: PortfolioFeeLineItem[] = [];
    for (const project of projects) {
      lineItems.push(await this.lineFor(project));
    }

    const registrationFeeCents = lineItems.reduce((a, l) => a + l.registrationFeeCents, 0);
    const reviewFeeCents = lineItems.reduce((a, l) => a + l.reviewFeeCents, 0);
    const subtotalCents = registrationFeeCents + reviewFeeCents;
    const warnings = this.dedupeWarnings(lineItems.flatMap((l) => l.warnings));

    return {
      anchorProjectId: anchorId,
      phase,
      lineItems,
      totals: {
        registrationFeeCents,
        reviewFeeCents,
        subtotalCents,
        taxCents: 0,
        totalCents: subtotalCents,
      },
      warnings,
    };
  }

  private async lineFor(project: Project): Promise<PortfolioFeeLineItem> {
    const paid = await this.invoices.findOne({
      where: { projectId: project.id, paidAt: Not(IsNull()) },
    });
    let registrationFeeCents = 0;
    let warnings: { reason: string }[] = [];
    if (!paid) {
      const ratingSystem = await this.catalog.getRatingSystem(project.ratingSystemId);
      const feeQuote = await this.fees.quote(ratingSystem.slug, project.membershipLevel);
      registrationFeeCents = feeQuote.totalCents;
      warnings = feeQuote.warnings.map((w) => ({ reason: w.reason }));
    }
    return {
      projectId: project.id,
      displayProjectId: project.gbciDisplayId,
      registrationFeeCents,
      reviewFeeCents: 0,
      totalCents: registrationFeeCents,
      warnings,
    };
  }

  private dedupeWarnings(warnings: { reason: string }[]): { reason: string }[] {
    const seen = new Set<string>();
    const out: { reason: string }[] = [];
    for (const w of warnings) {
      if (!seen.has(w.reason)) {
        seen.add(w.reason);
        out.push(w);
      }
    }
    return out;
  }
}
