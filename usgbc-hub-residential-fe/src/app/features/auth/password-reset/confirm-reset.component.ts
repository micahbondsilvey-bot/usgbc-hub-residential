import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { equalToControl } from './equal-to.validator';

@Component({
  selector: 'app-confirm-reset',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Choose a new password</h1>
      @if (!token()) {
        <p class="error">This reset link is missing its token.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            />
          </div>
          <div class="field">
            <label for="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
            @if (form.controls.confirmPassword.hasError('notEqual')) {
              <span class="error">Passwords do not match.</span>
            }
          </div>
          <button class="primary" type="submit" [disabled]="form.invalid || pending()">
            {{ pending() ? 'Updating…' : 'Update password' }}
          </button>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </form>
      }
    </section>
  `,
})
export class ConfirmResetComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, equalToControl('newPassword')]],
  });

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  async submit(): Promise<void> {
    const token = this.token();
    if (this.form.invalid || !token) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.confirmPasswordReset(token, this.form.getRawValue().newPassword),
      );
      await this.router.navigate(['/login'], { queryParams: { reset: 'ok' } });
    } catch {
      this.error.set('This reset link is invalid or has expired.');
    } finally {
      this.pending.set(false);
    }
  }
}
