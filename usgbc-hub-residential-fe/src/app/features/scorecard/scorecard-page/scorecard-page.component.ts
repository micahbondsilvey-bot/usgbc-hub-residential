import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ScorecardStore } from '../scorecard.store';
import { ScorecardSummaryBarComponent } from '../components/scorecard-summary-bar.component';
import { ScorecardViewTabsComponent } from '../components/scorecard-view-tabs.component';
import { PointCellComponent } from '../components/point-cell.component';
import { CreditDto, WarningColumn } from '../../../core/api/dto';

@Component({
  selector: 'app-scorecard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ScorecardSummaryBarComponent,
    ScorecardViewTabsComponent,
    PointCellComponent,
  ],
  template: `
    <div class="scorecard" [attr.aria-busy]="store.loading()">
      <gbci-scorecard-summary-bar [summary]="store.summary()" />
      <gbci-scorecard-view-tabs />

      <section class="panel">
        <button type="button" class="panel-toggle" (click)="infoExpanded.set(!infoExpanded())">
          Project info {{ infoExpanded() ? '▾' : '▸' }}
        </button>
        @if (infoExpanded()) {
          <div class="panel-body">
            <div><span class="k">Project</span> {{ store.projectId() }}</div>
            <div><span class="k">GBCI ID</span> RES-DEMO-001</div>
            <div><span class="k">Rating system</span> {{ store.catalog()?.name }}</div>
            <p class="hint">Editing project info arrives in Unit 3.</p>
          </div>
        }
      </section>

      @if (store.errorMessage()) {
        <p class="error" role="alert">{{ store.errorMessage() }}</p>
      }

      @for (cat of store.catalog()?.categories ?? []; track cat.id) {
        <section class="category">
          <header>
            <h2>{{ cat.name }}</h2>
            <span class="cat-total">{{ categoryAwarded(cat.id) }} awarded</span>
          </header>
          <table class="credits">
            <thead>
              <tr>
                <th class="credit-col">Credit</th>
                <th>Attempted?</th>
                <th>Attempted</th>
                <th>Verified</th>
                <th>Awarded</th>
              </tr>
            </thead>
            <tbody>
              @for (credit of cat.credits; track credit.id) {
                <tr>
                  <td class="credit-col">
                    <div class="credit-name">
                      {{ credit.name }}
                      @if (credit.kind === 'prerequisite') {
                        <span class="prereq">Prerequisite</span>
                      } @else {
                        <span class="range">{{ credit.pointsMin }}–{{ credit.pointsMax }} pts</span>
                      }
                    </div>
                    @if (credit.intent) {
                      <div class="intent">{{ credit.intent }}</div>
                    }
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="isAttempted(credit.id)"
                      [disabled]="credit.kind === 'prerequisite' || !store.canToggleAttempted()"
                      [attr.data-testid]="'scorecard-attempted-toggle-' + credit.slug"
                      (change)="onToggle(credit, $event)"
                    />
                  </td>
                  <td>
                    <gbci-point-cell
                      [creditSlug]="credit.slug"
                      column="attempted"
                      [value]="pointOf(credit.id, 'attempted')"
                      [editable]="store.canWrite('attempted')"
                      [warn]="isOutOfRange(credit, pointOf(credit.id, 'attempted'))"
                      (valueChange)="store.setPoint(credit.id, 'attempted', $event)"
                    />
                  </td>
                  <td>
                    <gbci-point-cell
                      [creditSlug]="credit.slug"
                      column="verified"
                      [value]="pointOf(credit.id, 'verified')"
                      [editable]="store.canWrite('verified')"
                      [warn]="isOutOfRange(credit, pointOf(credit.id, 'verified'))"
                      (valueChange)="store.setPoint(credit.id, 'verified', $event)"
                    />
                  </td>
                  <td>
                    <gbci-point-cell
                      [creditSlug]="credit.slug"
                      column="awarded"
                      [value]="pointOf(credit.id, 'awarded')"
                      [editable]="store.canWrite('awarded')"
                      [warn]="isOutOfRange(credit, pointOf(credit.id, 'awarded'))"
                      (valueChange)="store.setPoint(credit.id, 'awarded', $event)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .scorecard {
        max-width: 1000px;
        margin: 1.5rem auto;
        padding: 0 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .panel,
      .category {
        background: #fff;
        border: 1px solid var(--usgbc-border);
        border-radius: 10px;
      }
      .panel-toggle {
        width: 100%;
        text-align: left;
        border: none;
        background: none;
        padding: 0.75rem 1rem;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .panel-body {
        padding: 0 1rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .panel-body .k {
        display: inline-block;
        width: 120px;
        color: var(--usgbc-muted);
      }
      .category header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--usgbc-border);
      }
      .category h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .cat-total {
        color: var(--usgbc-green-dark);
        font-weight: 600;
      }
      table.credits {
        width: 100%;
        border-collapse: collapse;
      }
      table.credits th,
      table.credits td {
        padding: 0.6rem 1rem;
        text-align: center;
        border-bottom: 1px solid var(--usgbc-border);
      }
      table.credits th.credit-col,
      table.credits td.credit-col {
        text-align: left;
      }
      .credit-name {
        font-weight: 600;
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
      }
      .prereq {
        font-size: 0.7rem;
        background: var(--usgbc-ink);
        color: #fff;
        border-radius: 4px;
        padding: 0.1rem 0.4rem;
      }
      .range {
        font-size: 0.75rem;
        color: var(--usgbc-muted);
      }
      .intent {
        font-size: 0.8rem;
        color: var(--usgbc-muted);
        margin-top: 0.2rem;
      }
      @media (max-width: 768px) {
        table.credits th:nth-child(3),
        table.credits td:nth-child(3) {
          display: none;
        }
      }
    `,
  ],
})
export class ScorecardPageComponent implements OnInit {
  readonly store = inject(ScorecardStore);
  private readonly route = inject(ActivatedRoute);
  readonly infoExpanded = signal(true);

  private readonly entriesView = computed(() => this.store.entries());

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) void this.store.loadFor(projectId);
  }

  isAttempted(creditId: string): boolean {
    return this.entriesView().get(creditId)?.attempted ?? false;
  }

  pointOf(creditId: string, column: WarningColumn): number {
    const entry = this.entriesView().get(creditId);
    if (!entry) return 0;
    if (column === 'attempted') return entry.attemptedPoints;
    if (column === 'verified') return entry.verifiedPoints;
    return entry.awardedPoints;
  }

  categoryAwarded(categoryId: string): number {
    return this.store.summary()?.perCategory.find((c) => c.categoryId === categoryId)?.awarded ?? 0;
  }

  isOutOfRange(credit: CreditDto, value: number): boolean {
    if (credit.kind !== 'credit') return false;
    const min = credit.pointsMin ?? 0;
    const max = credit.pointsMax ?? 0;
    return value < min || value > max;
  }

  onToggle(credit: CreditDto, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      void this.store.attempt(credit.id);
    } else {
      const ok = window.confirm('Clear entered points for this credit?');
      if (ok) {
        void this.store.unattempt(credit.id);
      } else {
        (event.target as HTMLInputElement).checked = true; // revert
      }
    }
  }
}
