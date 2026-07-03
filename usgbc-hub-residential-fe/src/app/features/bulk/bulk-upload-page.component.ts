import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { BulkUploadResponse } from '../../core/api/dto';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-bulk-upload-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="wrap">
      <h1>Bulk registration</h1>
      <div class="card">
        <p class="hint">
          Upload an .xlsx/.xls file (max 2 MB, 200 rows). Each row needs a unique
          <code>external_row_id</code> — re-uploading a corrected sheet won't create duplicates.
        </p>
        <input type="file" accept=".xlsx,.xls" (change)="onFile($event)" [disabled]="uploading()" />
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (uploading()) { <p class="hint">Processing…</p> }
      </div>

      @if (result(); as r) {
        <div class="card">
          <h2>Results</h2>
          <p>{{ r.succeeded }} created · {{ r.failed }} failed · {{ r.totalRows }} total</p>
          <table>
            <thead><tr><th></th><th>Row ID</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>
              @for (o of r.perRowOutcomes; track o.externalRowId) {
                <tr>
                  <td>{{ o.status === 'CREATED' ? '✓' : '✕' }}</td>
                  <td>{{ o.externalRowId }}</td>
                  <td>{{ o.status }}</td>
                  <td>{{ o.projectId ?? o.errorMessage ?? '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 820px; margin: 1.5rem auto; padding: 0 1rem; }
      .card { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--usgbc-border); }
    `,
  ],
})
export class BulkUploadPageComponent {
  private readonly api = inject(ApiClient);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<BulkUploadResponse | null>(null);

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      this.error.set('File exceeds the 2 MB limit.');
      return;
    }
    this.error.set(null);
    this.uploading.set(true);
    try {
      this.result.set(await firstValueFrom(this.api.uploadBulkRegistration(file)));
    } catch {
      this.error.set('Upload failed. Check the file format and try again.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
