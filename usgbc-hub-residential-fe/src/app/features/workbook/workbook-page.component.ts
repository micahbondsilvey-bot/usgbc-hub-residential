import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreditWorkbookDto,
  NoteColumn,
  ProjectRole,
  WorkbookFieldEntryDto,
} from '../../core/api/dto';

@Component({
  selector: 'app-workbook-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="wrap" [attr.aria-busy]="loading()">
      <h1>Workbook</h1>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="hint">Loading…</p> }

      @for (credit of credits(); track credit.creditId) {
        <article class="credit" [id]="'credit-' + credit.creditId">
          <h2>{{ creditName(credit.creditId) }}</h2>

          <!-- Field Verification -->
          @if (credit.fieldEntries.length) {
            <h3>Field Verification</h3>
            @for (group of grouped(credit); track group.area) {
              <div class="area">
                <h4>{{ group.area }}</h4>
                @for (f of group.fields; track f.fieldDefinitionId) {
                  <div class="field-row">
                    <label>{{ f.label }} @if (f.unit) { <span class="unit">({{ f.unit }})</span> }</label>
                    @if (f.derived) {
                      <span class="derived">{{ f.value ?? '—' }} <em>computed</em></span>
                    } @else if (f.dataType === 'boolean') {
                      <input type="checkbox" [checked]="f.value === true"
                        [disabled]="!canEditFields()"
                        (change)="saveField(credit.creditId, f, $any($event.target).checked)" />
                    } @else if (f.dataType === 'enum') {
                      <select [disabled]="!canEditFields()"
                        (change)="saveField(credit.creditId, f, $any($event.target).value)">
                        <option value="">—</option>
                        @for (opt of f.enumOptions ?? []; track opt) {
                          <option [value]="opt" [selected]="f.value === opt">{{ opt }}</option>
                        }
                      </select>
                    } @else {
                      <input [type]="f.dataType === 'integer' || f.dataType === 'decimal' ? 'number' : (f.dataType === 'date' ? 'date' : 'text')"
                        [value]="f.value ?? ''" [disabled]="!canEditFields()"
                        (blur)="saveField(credit.creditId, f, $any($event.target).value)" />
                    }
                  </div>
                }
              </div>
            }
          }

          <!-- Submittals -->
          @if (credit.slots.length) {
            <h3>Submittals</h3>
            @for (slot of credit.slots; track slot.id) {
              <div class="slot">
                <div class="slot-head">
                  <strong>{{ slot.label }}</strong>
                  @if (slot.requirementNote) { <span class="hint">{{ slot.requirementNote }}</span> }
                </div>
                <ul>
                  @for (file of slot.files; track file.id) {
                    <li>
                      <button type="button" class="link" (click)="download(file.id)">{{ file.originalFileName }}</button>
                      <span class="hint">{{ (file.sizeBytes / 1024) | number: '1.0-0' }} KB</span>
                      @if (canEditFields()) {
                        <button type="button" class="link danger" (click)="removeFile(file.id)">delete</button>
                      }
                    </li>
                  }
                </ul>
                @if (canUpload() && (slot.multiUpload || slot.files.length === 0)) {
                  <input type="file" (change)="upload(credit.creditId, slot.slotKey, $event)" />
                }
              </div>
            }
          }

          <!-- Verification Notes (3 columns) -->
          <h3>Verification Notes</h3>
          <div class="notes">
            @for (note of credit.notes; track note.column) {
              <div class="note-col">
                <label>{{ noteLabel(note.column) }}</label>
                <textarea rows="3" [ngModel]="note.body" (ngModelChange)="note.body = $event"
                  [disabled]="!canWriteNote(note.column)"></textarea>
                @if (note.savedAt) { <span class="hint">saved {{ note.savedAt | date: 'short' }}</span> }
                @if (canWriteNote(note.column)) {
                  <button type="button" class="link" (click)="saveNote(credit.creditId, note.column, note.body ?? null)">Save</button>
                }
              </div>
            }
          </div>
        </article>
      }

      @if (!loading() && credits().length === 0) {
        <p class="hint">No attempted credits yet. Attempt credits on the scorecard to build the workbook.</p>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 960px; margin: 1.5rem auto; padding: 0 1rem; }
      .credit { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
      h3 { margin: 1rem 0 0.5rem; color: var(--usgbc-green-dark); }
      h4 { margin: 0.5rem 0 0.25rem; color: var(--usgbc-muted); font-size: 0.85rem; text-transform: uppercase; }
      .field-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.3rem 0; }
      .field-row input[type='text'], .field-row input[type='number'], .field-row input[type='date'], .field-row select { min-height: 40px; border: 1px solid var(--usgbc-border); border-radius: 6px; padding: 0 0.5rem; }
      .derived { font-weight: 600; }
      .derived em { color: var(--usgbc-muted); font-weight: 400; font-size: 0.8rem; }
      .unit { color: var(--usgbc-muted); font-weight: 400; }
      .slot { border-top: 1px solid var(--usgbc-border); padding: 0.5rem 0; }
      .notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
      .note-col { display: flex; flex-direction: column; gap: 0.25rem; }
      .note-col textarea { border: 1px solid var(--usgbc-border); border-radius: 6px; padding: 0.4rem; }
      button.link { background: none; border: none; color: var(--usgbc-green-dark); cursor: pointer; text-decoration: underline; font: inherit; padding: 0; }
      button.link.danger { color: var(--usgbc-error); margin-left: 0.5rem; }
      @media (max-width: 768px) { .notes { grid-template-columns: 1fr; } }
    `,
  ],
})
export class WorkbookPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly credits = signal<CreditWorkbookDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private readonly role = signal<ProjectRole | null>(null);
  private readonly creditNames = signal<Map<string, string>>(new Map());
  private projectId = '';

  readonly isAdmin = computed(() => this.auth.isAdmin());

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    try {
      const [workbook, rs, me] = await Promise.all([
        firstValueFrom(this.api.getWorkbook(this.projectId)),
        firstValueFrom(this.api.getRatingSystem('leed_v4_1_sf')),
        firstValueFrom(this.api.meRole(this.projectId)),
      ]);
      this.credits.set(workbook.credits);
      this.role.set(me.projectRole);
      const names = new Map<string, string>();
      for (const cat of rs.categories) for (const c of cat.credits) names.set(c.id, c.name);
      this.creditNames.set(names);
    } catch {
      this.error.set('Could not load the workbook.');
    } finally {
      this.loading.set(false);
    }
  }

  creditName(creditId: string): string {
    return this.creditNames().get(creditId) ?? creditId;
  }

  grouped(credit: CreditWorkbookDto): Array<{ area: string; fields: WorkbookFieldEntryDto[] }> {
    const byArea = new Map<string, WorkbookFieldEntryDto[]>();
    for (const f of credit.fieldEntries) {
      const area = f.areaTag ?? 'General';
      const list = byArea.get(area) ?? [];
      list.push(f);
      byArea.set(area, list);
    }
    return [...byArea.entries()].map(([area, fields]) => ({ area, fields }));
  }

  canEditFields(): boolean {
    return this.isAdmin() || this.role() === 'PROJECT_TEAM' || this.role() === 'GREEN_RATER';
  }

  canUpload(): boolean {
    return this.canEditFields();
  }

  canWriteNote(column: NoteColumn): boolean {
    if (this.isAdmin()) return true;
    const r = this.role();
    if (column === 'GREEN_RATER') return r === 'PROJECT_TEAM' || r === 'GREEN_RATER';
    if (column === 'PROVIDER_QC') return r === 'GREEN_RATER';
    return r === 'REVIEWER';
  }

  noteLabel(column: NoteColumn): string {
    return column === 'GREEN_RATER'
      ? 'Green Rater'
      : column === 'PROVIDER_QC'
        ? 'Provider QC'
        : 'Reviewer';
  }

  async saveField(
    creditId: string,
    field: WorkbookFieldEntryDto,
    raw: string | boolean,
  ): Promise<void> {
    let value: string | number | boolean | null = raw as string | boolean;
    if (field.dataType === 'integer' || field.dataType === 'decimal') {
      value = raw === '' ? null : Number(raw);
    }
    try {
      const res = await firstValueFrom(
        this.api.writeFieldEntry(this.projectId, creditId, field.fieldDefinitionId, { value }),
      );
      // Refresh this credit so derived fields update.
      await this.reloadCredit(creditId);
      void res;
    } catch {
      this.error.set('Could not save the field.');
    }
  }

  async saveNote(creditId: string, column: NoteColumn, body: string | null): Promise<void> {
    try {
      await firstValueFrom(this.api.writeNote(this.projectId, creditId, column, { body }));
    } catch {
      this.error.set('Could not save the note.');
    }
  }

  async upload(creditId: string, slotKey: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await firstValueFrom(this.api.uploadSubmittal(this.projectId, creditId, slotKey, file));
      await this.reloadCredit(creditId);
    } catch {
      this.error.set('Upload failed.');
    } finally {
      input.value = '';
    }
  }

  async removeFile(submittalId: string): Promise<void> {
    if (!window.confirm('Delete this file?')) return;
    try {
      await firstValueFrom(this.api.deleteSubmittal(this.projectId, submittalId));
      await this.reload();
    } catch {
      this.error.set('Could not delete the file.');
    }
  }

  async download(submittalId: string): Promise<void> {
    try {
      const { url } = await firstValueFrom(this.api.getSubmittalUrl(this.projectId, submittalId));
      window.open(url, '_blank');
    } catch {
      this.error.set('Could not open the file.');
    }
  }

  private async reload(): Promise<void> {
    const workbook = await firstValueFrom(this.api.getWorkbook(this.projectId));
    this.credits.set(workbook.credits);
  }

  private async reloadCredit(creditId: string): Promise<void> {
    const updated = await firstValueFrom(
      this.api.getWorkbook(this.projectId),
    );
    const match = updated.credits.find((c) => c.creditId === creditId);
    if (!match) return;
    this.credits.update((list) => list.map((c) => (c.creditId === creditId ? match : c)));
  }
}
