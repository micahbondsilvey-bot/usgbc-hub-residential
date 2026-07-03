import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { CertificationAgreementDto, InvoiceDto, ProjectDto } from '../../core/api/dto';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="wrap">
      @if (project(); as p) {
        <header class="head">
          <div>
            <h1>{{ p.name }}</h1>
            <p class="hint">{{ p.gbciDisplayId ?? 'Draft' }} · {{ p.status }}</p>
          </div>
          <div class="links">
            <a [routerLink]="['/projects', p.id, 'scorecard']">Scorecard</a>
            <a [routerLink]="['/projects', p.id, 'workbook']">Workbook</a>
            <a [routerLink]="['/projects', p.id, 'review']">Review</a>
            <a [routerLink]="['/projects', p.id, 'portfolio']">Portfolio</a>
          </div>
        </header>

        <div class="card">
          <h2>Project info</h2>
          <dl>
            <dt>Rating system</dt><dd>{{ p.membershipLevel }}</dd>
            <dt>Building type</dt><dd>{{ p.buildingType }}</dd>
            <dt>Gross area</dt><dd>{{ p.grossArea ?? '—' }} sq ft</dd>
            <dt>Target level</dt><dd>{{ p.targetCertificationLevel ?? '—' }}</dd>
            <dt>Owner</dt><dd>{{ p.ownerName }} ({{ p.ownerEmail }})</dd>
            <dt>Address</dt><dd>{{ p.addressLine1 }}, {{ p.city }} {{ p.region }} {{ p.postalCode }} {{ p.country }}</dd>
          </dl>
        </div>

        @if (invoice(); as inv) {
          <div class="card">
            <h2>Invoice {{ inv.displayId }}</h2>
            <p>{{ inv.status }} · {{ usd(inv.totalCents) }} · {{ inv.paymentChoice }}</p>
          </div>
        }

        @if (agreement(); as ag) {
          <div class="card">
            <h2>Certification agreement</h2>
            <p>Signed by {{ ag.signedByName }} on {{ ag.signedAt | date: 'mediumDate' }}
              (version {{ ag.agreementVersion }}).</p>
          </div>
        }

        @if (canWithdraw()) {
          <button class="danger" type="button" (click)="withdraw(p.id)">Withdraw project</button>
        }
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <p class="hint">Loading…</p>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 720px; margin: 1.5rem auto; padding: 0 1rem; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; }
      .card { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
      dl { display: grid; grid-template-columns: 160px 1fr; gap: 0.35rem 1rem; }
      dt { color: var(--usgbc-muted); }
      .danger { min-height: 44px; padding: 0 1rem; border: 1px solid var(--usgbc-error); color: var(--usgbc-error); background: #fff; border-radius: 6px; cursor: pointer; }
    `,
  ],
})
export class ProjectDetailPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly project = signal<ProjectDto | null>(null);
  readonly invoice = signal<InvoiceDto | null>(null);
  readonly agreement = signal<CertificationAgreementDto | null>(null);
  readonly error = signal<string | null>(null);
  readonly canWithdraw = signal(true);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('projectId');
    if (!id) return;
    try {
      this.project.set(await firstValueFrom(this.api.getProject(id)));
      this.invoice.set(await firstValueFrom(this.api.getInvoice(id)).catch(() => null));
      this.agreement.set(await firstValueFrom(this.api.getAgreement(id)).catch(() => null));
    } catch {
      this.error.set('Could not load this project.');
    }
  }

  usd(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      cents / 100,
    );
  }

  async withdraw(id: string): Promise<void> {
    if (!window.confirm('Withdraw this project? This cannot be undone.')) return;
    try {
      const updated = await firstValueFrom(this.api.withdrawProject(id, 'Withdrawn by user'));
      this.project.set(updated);
    } catch {
      this.error.set('Could not withdraw the project.');
    }
  }
}
