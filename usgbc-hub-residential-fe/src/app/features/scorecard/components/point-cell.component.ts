import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { WarningColumn } from '../../../core/api/dto';

/**
 * Inline non-negative integer editor for a single scorecard point column.
 * Out-of-range values still save (BR-S6) but render with a warning style.
 */
@Component({
  selector: 'gbci-point-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editable()) {
      <input
        class="cell"
        type="number"
        min="0"
        step="1"
        [class.warn]="warn()"
        [value]="draft()"
        [attr.data-warning]="warn() ? 'true' : null"
        [attr.data-testid]="'scorecard-point-cell-' + column() + '-' + creditSlug()"
        [attr.aria-label]="column() + ' points'"
        (input)="onInput($event)"
        (blur)="commit()"
        (keyup.enter)="commit()"
      />
    } @else {
      <span class="cell readonly" [class.warn]="warn()">{{ draft() }}</span>
    }
  `,
  styles: [
    `
      .cell {
        width: 4rem;
        min-height: 40px;
        text-align: center;
        border: 1px solid var(--usgbc-border);
        border-radius: 6px;
        font-size: 1rem;
      }
      .cell.readonly {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--usgbc-bg);
        color: var(--usgbc-muted);
      }
      .cell.warn {
        border-color: #d08700;
        background: #fff7e6;
      }
    `,
  ],
})
export class PointCellComponent {
  readonly creditSlug = input.required<string>();
  readonly column = input.required<WarningColumn>();
  readonly value = input.required<number>();
  readonly editable = input(true);
  readonly warn = input(false);

  readonly valueChange = output<number>();
  readonly draft = signal(0);

  constructor() {
    effect(() => this.draft.set(this.value()));
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    this.draft.set(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  }

  commit(): void {
    if (this.draft() !== this.value()) {
      this.valueChange.emit(this.draft());
    }
  }
}
