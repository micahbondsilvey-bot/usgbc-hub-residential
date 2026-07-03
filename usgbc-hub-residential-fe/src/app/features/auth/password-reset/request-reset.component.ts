import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';

@Component({
  selector: 'app-request-reset',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Reset your password</h1>
      @if (submitted()) {
        <p class="hint" role="status">
          If an account exists for that email, a reset link is on its way.
        </p>
        <p class="hint"><a routerLink="/login">Back to log in</a></p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="request()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" autocomplete="username" />
          </div>
          <button class="primary" type="submit" [disabled]="form.invalid || pending()">
            {{ pending() ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      }
    </section>
  `,
})
export class RequestResetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);

  readonly pending = signal(false);
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async request(): Promise<void> {
    if (this.form.invalid) return;
    this.pending.set(true);
    try {
      await firstValueFrom(this.api.requestPasswordReset(this.form.getRawValue().email));
    } catch {
      // Response is intentionally generic (BR-A3); ignore errors client-side.
    } finally {
      this.pending.set(false);
      this.submitted.set(true);
    }
  }
}
