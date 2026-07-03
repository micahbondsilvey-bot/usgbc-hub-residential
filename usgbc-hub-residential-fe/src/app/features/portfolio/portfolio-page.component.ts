import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import {
  BatchSubmitResult,
  PortfolioDashboardDto,
  PortfolioFeeQuoteDto,
  ReviewPhase,
} from '../../core/api/dto';

@Component({
  selector: 'app-portfolio-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="wrap">
      <h1>Portfolio</h1>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (notAnchor()) {
        <div class="card">
          <p>This project is not a portfolio anchor.</p>
          <button class="primary" type="button" (click)="designate()">Designate as anchor</button>
        </div>
      }

      @if (dashboard(); as d) {
        <div class="card">
          <h2>{{ d.anchor.name }} <span class="anchor-badge">ANCHOR</span></h2>
          <p class="hint">{{ d.anchor.gbciDisplayId }} · {{ d.anchor.status }}</p>
          <p>Awarded {{ d.rollup.awardedTotal }} across {{ d.rollup.totalChildren }} children.</p>
        </div>

        <div class="card">
          <h2>Batch submit</h2>
          <select [(ngModel)]="phase">
            <option value="PRELIMINARY">Preliminary</option>
            <option value="FINAL">Final</option>
            <option value="SUPPLEMENTAL">Supplemental</option>
          </select>
          <button class="primary" type="button" (click)="loadQuote()" [disabled]="busy()">Fee quote</button>
          <button class="primary" type="button" (click)="submit()" [disabled]="busy()">Submit portfolio</button>
          @if (quote(); as q) {
            <p class="hint">Combined total: {{ usd(q.totals.totalCents) }}
              @if (q.warnings.length) { · warnings: {{ q.warnings.length }} }</p>
          }
        </div>

        @if (result(); as r) {
          <div class="card">
            <h2>Batch result</h2>
            <p>{{ r.summary.submittedCount }} submitted · {{ r.summary.skippedCount }} skipped · {{ r.summary.failedCount }} failed</p>
            <ul>
              <li>
                <strong>Anchor:</strong> {{ r.anchor.status }}
                {{ r.anchor.reviewDisplayId ?? r.anchor.reason ?? r.anchor.error?.message ?? '' }}
              </li>
              @for (c of r.children; track c.projectId) {
                <li>
                  {{ c.displayProjectId ?? c.projectId }} — {{ c.status }}
                  {{ c.reviewDisplayId ?? c.reason ?? c.error?.message ?? '' }}
                </li>
              }
            </ul>
          </div>
        }

        <div class="card">
          <h2>Children</h2>
          <table>
            <thead><tr><th>GBCI ID</th><th>Name</th><th>Status</th><th>Awarded</th><th></th></tr></thead>
            <tbody>
              @for (c of d.children; track c.id) {
                <tr>
                  <td>{{ c.gbciDisplayId ?? '—' }}</td>
                  <td><a [routerLink]="['/projects', c.id]">{{ c.name }}</a></td>
                  <td>{{ c.status }}</td>
                  <td>{{ c.awardedTotal }}</td>
                  <td><button class="link" type="button" (click)="detach(c.id)">detach</button></td>
                </tr>
              }
            </tbody>
          </table>
          <div class="attach">
            <input type="text" placeholder="Child project ID to attach" [(ngModel)]="attachId" />
            <button class="link" type="button" (click)="attach()">Attach child</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 900px; margin: 1.5rem auto; padding: 0 1rem; }
      .card { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
      .anchor-badge { font-size: 0.65rem; background: var(--usgbc-green); color: #fff; padding: 0.1rem 0.4rem; border-radius: 4px; vertical-align: middle; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--usgbc-border); }
      .attach { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
      .attach input { flex: 1; min-height: 40px; border: 1px solid var(--usgbc-border); border-radius: 6px; padding: 0 0.5rem; }
      button.primary { width: auto; padding: 0 1rem; margin-left: 0.5rem; }
      button.link { background: none; border: none; color: var(--usgbc-green-dark); text-decoration: underline; cursor: pointer; font: inherit; }
      select { min-height: 40px; }
    `,
  ],
})
export class PortfolioPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly dashboard = signal<PortfolioDashboardDto | null>(null);
  readonly quote = signal<PortfolioFeeQuoteDto | null>(null);
  readonly result = signal<BatchSubmitResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly notAnchor = signal(false);
  readonly busy = signal(false);

  phase: ReviewPhase = 'PRELIMINARY';
  attachId = '';
  private projectId = '';

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.error.set(null);
    this.notAnchor.set(false);
    try {
      this.dashboard.set(await firstValueFrom(this.api.getPortfolioDashboard(this.projectId)));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.notAnchor.set(true);
      } else {
        this.error.set('Could not load the portfolio.');
      }
    }
  }

  usd(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  async designate(): Promise<void> {
    await this.run(() => firstValueFrom(this.api.toggleAnchor(this.projectId, true)));
  }

  async loadQuote(): Promise<void> {
    this.busy.set(true);
    try {
      this.quote.set(await firstValueFrom(this.api.getPortfolioFeeQuote(this.projectId, this.phase)));
    } catch {
      this.error.set('Could not load the fee quote.');
    } finally {
      this.busy.set(false);
    }
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.portfolioSubmit(this.projectId, this.phase)));
      await this.load();
    } catch (err) {
      // Anchor cascade returns the BatchSubmitResult in the error body.
      const body = err instanceof HttpErrorResponse ? err.error : null;
      if (body?.result) {
        this.result.set(body.result as BatchSubmitResult);
      } else {
        this.error.set('Batch submit could not be completed.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  async attach(): Promise<void> {
    if (!this.attachId.trim()) return;
    await this.run(() => firstValueFrom(this.api.setParentAnchor(this.attachId.trim(), this.projectId)));
    this.attachId = '';
  }

  async detach(childId: string): Promise<void> {
    await this.run(() => firstValueFrom(this.api.setParentAnchor(childId, null)));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.load();
    } catch {
      this.error.set('That action could not be completed.');
    } finally {
      this.busy.set(false);
    }
  }
}
