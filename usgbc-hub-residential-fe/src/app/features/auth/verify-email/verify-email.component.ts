import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';

type VerifyState = 'verifying' | 'verified' | 'invalid';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="card">
      <h1>Email verification</h1>
      @switch (state()) {
        @case ('verifying') {
          <p class="hint">Verifying your email…</p>
        }
        @case ('verified') {
          <p role="status">Your email has been verified.</p>
          <p class="hint"><a routerLink="/login">Continue to log in</a></p>
        }
        @case ('invalid') {
          <p class="error">This verification link is invalid or has expired.</p>
        }
      }
    </section>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<VerifyState>('verifying');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('invalid');
      return;
    }
    try {
      await firstValueFrom(this.api.verifyEmail(token));
      this.state.set('verified');
    } catch {
      this.state.set('invalid');
    }
  }
}
