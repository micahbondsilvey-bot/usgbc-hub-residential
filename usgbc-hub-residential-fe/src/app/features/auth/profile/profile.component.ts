import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient } from '../../../core/api/api-client';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Your profile</h1>
      <p class="hint">{{ auth.currentUser()?.email }}</p>
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label for="name">Name</label>
          <input id="name" type="text" formControlName="name" maxlength="200" />
        </div>
        <div class="field">
          <label for="organization">Organization</label>
          <input id="organization" type="text" formControlName="organization" maxlength="200" />
        </div>
        @if (auth.isGreenRater()) {
          <div class="field">
            <label for="grc">Green Rater credential ID</label>
            <input id="grc" type="text" formControlName="greenRaterCredentialId" maxlength="100" />
          </div>
        }
        <button class="primary" type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save changes' }}
        </button>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (saved()) {
          <p class="hint" role="status">Profile updated.</p>
        }
      </form>
    </section>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);
  readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [''],
    organization: [''],
    greenRaterCredentialId: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.api.getProfile());
      this.auth.currentUser.set(profile);
      this.form.patchValue({
        name: profile.name ?? '',
        organization: profile.organization ?? '',
        greenRaterCredentialId: profile.greenRaterCredentialId ?? '',
      });
    } catch {
      this.error.set('Could not load your profile.');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const value = this.form.getRawValue();
    try {
      const updated = await firstValueFrom(
        this.api.updateProfile({
          name: value.name,
          organization: value.organization,
          greenRaterCredentialId: value.greenRaterCredentialId || undefined,
        }),
      );
      this.auth.currentUser.set(updated);
      this.saved.set(true);
    } catch {
      this.error.set('Could not save your changes.');
    } finally {
      this.saving.set(false);
    }
  }
}
