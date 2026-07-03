import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Log in</h1>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </div>
        <button class="primary" type="submit" [disabled]="form.invalid || pending()">
          {{ pending() ? 'Signing in…' : 'Log in' }}
        </button>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </form>
      <p class="hint">
        <a routerLink="/auth/password/reset/request">Forgot your password?</a>
      </p>
    </section>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.pending.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') ?? '/dashboard';
      await this.router.navigateByUrl(redirectTo);
    } catch {
      this.error.set('Invalid email or password.');
    } finally {
      this.pending.set(false);
    }
  }
}
