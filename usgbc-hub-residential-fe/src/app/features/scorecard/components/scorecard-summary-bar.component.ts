import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ScorecardSummary } from '../../../core/api/dto';

@Component({
  selector: 'gbci-scorecard-summary-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary(); as s) {
      <div class="bar" role="status">
        <div class="metric"><span class="label">Attempted</span><span class="value">{{ s.overall.attempted }}</span></div>
        <div class="metric"><span class="label">Verified</span><span class="value">{{ s.overall.verified }}</span></div>
        <div class="metric"><span class="label">Awarded</span><span class="value">{{ s.overall.awarded }}</span></div>
        <div class="metric"><span class="label">Available</span><span class="value">{{ s.overall.totalAvailable }}</span></div>
        <div class="chip" [class.none]="!s.certificationLevel">
          {{ s.certificationLevel ?? 'No level yet' }}
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 1.5rem;
        padding: 1rem 1.25rem;
        background: #fff;
        border: 1px solid var(--usgbc-border);
        border-radius: 10px;
      }
      .metric {
        display: flex;
        flex-direction: column;
      }
      .label {
        font-size: 0.75rem;
        color: var(--usgbc-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .value {
        font-size: 1.5rem;
        font-weight: 700;
      }
      .chip {
        margin-left: auto;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        background: var(--usgbc-green);
        color: #fff;
        font-weight: 700;
      }
      .chip.none {
        background: var(--usgbc-muted);
      }
      @media (max-width: 480px) {
        .bar {
          flex-direction: column;
          align-items: flex-start;
        }
        .chip {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class ScorecardSummaryBarComponent {
  readonly summary = input.required<ScorecardSummary | null>();
}
