import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { InvitationPreview } from '../../../core/api/dto';
import { equalToControl } from '../password-reset/equal-to.validator';

type InviteState =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'needs-login'
  | 'needs-account'
  | 'ready'
  | 'success'
  | 'error';

@Component({
  selector: 'app-invite-accept',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Project invitation</h1>
      @switch (state()) {
        @case ('loading') {
          <p class="hint">Loading your invitation…</p>
        }
        @case ('invalid') {
          <p class="error">This invitation could not be found.</p>
        }
        @case ('expired') {
          <p class="error">
            This invitation has expired or is no longer active. Ask a project member to send a new
            one.
          </p>
        }
        @case ('needs-login') {
          <p>You have an account for {{ preview()?.inviteeEmail }}. Log in to accept.</p>
          <form [formGroup]="loginForm" (ngSubmit)="loginThenAccept()">
            <div class="field">
              <label for="password">Password</label>
              <input id="password" type="password" formControlName="password" />
            </div>
            <button class="primary" type="submit" [disabled]="loginForm.invalid || pending()">
              Log in &amp; accept
            </button>
          </form>
        }
        @case ('needs-account') {
          <p>Create your account for {{ preview()?.inviteeEmail }} to accept as
            {{ preview()?.projectRole }}.</p>
          <form [formGroup]="accountForm" (ngSubmit)="accept()">
            <div class="field">
              <label for="name">Name</label>
              <input id="name" type="text" formControlName="name" />
            </div>
            <div class="field">
              <label for="newPassword">Password</label>
              <input id="newPassword" type="password" formControlName="newPassword" />
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" />
              @if (accountForm.controls.confirmPassword.hasError('notEqual')) {
                <span class="error">Passwords do not match.</span>
              }
            </div>
            <button class="primary" type="submit" [disabled]="accountForm.invalid || pending()">
              Create account &amp; accept
            </button>
          </form>
        }
        @case ('ready') {
          <p>Accept the invitation to join as {{ preview()?.projectRole }}.</p>
          <button class="primary" type="button" (click)="accept()" [disabled]="pending()">
            Accept invitation
          </button>
        }
        @case ('success') {
          <p role="status">You're in. Redirecting to your project…</p>
        }
        @case ('error') {
          <p class="error">{{ error() }}</p>
        }
      }
    </section>
  `,
})
export class InviteAcceptComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly state = signal<InviteState>('loading');
  readonly preview = signal<InvitationPreview | null>(null);
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);

  private token = '';

  readonly loginForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly accountForm = this.fb.nonNullable.group({
    name: [''],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, equalToControl('newPassword')]],
  });

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    try {
      const preview = await firstValueFrom(this.api.previewInvitation(this.token));
      this.preview.set(preview);
      if (preview.state !== 'PENDING') {
        this.state.set('expired');
        return;
      }
      if (!preview.accountExists) {
        this.state.set('needs-account');
      } else if (!this.auth.isAuthenticated()) {
        this.state.set('needs-login');
      } else {
        this.state.set('ready');
      }
    } catch {
      this.state.set('invalid');
    }
  }

  async loginThenAccept(): Promise<void> {
    const preview = this.preview();
    if (this.loginForm.invalid || !preview) return;
    this.pending.set(true);
    try {
      await this.auth.login(preview.inviteeEmail, this.loginForm.getRawValue().password);
      await this.accept();
    } catch {
      this.error.set('Could not log in with those credentials.');
      this.state.set('error');
    } finally {
      this.pending.set(false);
    }
  }

  async accept(): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    const newPassword =
      this.state() === 'needs-account'
        ? this.accountForm.getRawValue().newPassword
        : undefined;
    const name =
      this.state() === 'needs-account' ? this.accountForm.getRawValue().name : undefined;
    try {
      const res = await firstValueFrom(
        this.api.acceptInvitation({ token: this.token, newPassword, name }),
      );
      this.state.set('success');
      setTimeout(() => void this.router.navigate(['/projects', res.projectId]), 800);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      if (status === 410) {
        this.state.set('expired');
      } else if (status === 409) {
        this.error.set(
          'You already have a different role on this project. Ask an Admin to revoke it first.',
        );
        this.state.set('error');
      } else {
        this.error.set('We could not accept this invitation.');
        this.state.set('error');
      }
    } finally {
      this.pending.set(false);
    }
  }
}
