import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

type ViewTab = 'all' | 'field-verification' | 'submittals' | 'verification-notes';

interface TabDef {
  key: ViewTab;
  label: string;
  enabled: boolean;
}

/**
 * View tabs (Q7=A). Only "All" is enabled in Unit 2; the others are disabled
 * with a tooltip and become available in Unit 4 (Workbook).
 */
@Component({
  selector: 'gbci-scorecard-view-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      @for (tab of tabs; track tab.key) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="active() === tab.key"
          [attr.aria-selected]="active() === tab.key"
          [attr.aria-disabled]="!tab.enabled"
          [disabled]="!tab.enabled"
          [title]="tab.enabled ? tab.label : 'Available after Unit 4 — Workbook'"
          (click)="select(tab)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 2px solid var(--usgbc-border);
      }
      .tab {
        border: none;
        background: none;
        padding: 0.6rem 1rem;
        font: inherit;
        cursor: pointer;
        color: var(--usgbc-muted);
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
      }
      .tab.active {
        color: var(--usgbc-green-dark);
        font-weight: 700;
        border-bottom-color: var(--usgbc-green);
      }
      .tab:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ScorecardViewTabsComponent {
  readonly tabChange = output<ViewTab>();
  readonly active = signal<ViewTab>('all');

  readonly tabs: TabDef[] = [
    { key: 'all', label: 'All', enabled: true },
    { key: 'field-verification', label: 'Field Verification', enabled: false },
    { key: 'submittals', label: 'Submittals', enabled: false },
    { key: 'verification-notes', label: 'Verification Notes', enabled: false },
  ];

  select(tab: TabDef): void {
    if (!tab.enabled) return;
    this.active.set(tab.key);
    this.tabChange.emit(tab.key);
  }
}
