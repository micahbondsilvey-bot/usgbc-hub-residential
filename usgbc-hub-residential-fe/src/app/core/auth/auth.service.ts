import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClient } from '../api/api-client';
import { Profile } from '../api/dto';

/**
 * Central auth state (Signals). Token is held in memory and optionally mirrored
 * to sessionStorage for demo persistence (Q4=B). Project roles are never stored
 * here — they are resolved per-project from the backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<Profile | null>(null);
  readonly accessToken = signal<string | null>(this.readStoredToken());

  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.globalRole === 'admin');
  readonly isGreenRater = computed(
    () => (this.currentUser()?.greenRaterCredentialId ?? null) !== null,
  );

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.api.login({ email, password }));
    this.setToken(res.accessToken);
    await this.refreshProfile();
  }

  async refreshProfile(): Promise<void> {
    const profile = await firstValueFrom(this.api.me());
    this.currentUser.set(profile);
  }

  logout(redirect = true): void {
    this.setToken(null);
    this.currentUser.set(null);
    if (redirect) void this.router.navigate(['/login']);
  }

  setToken(token: string | null): void {
    this.accessToken.set(token);
    if (!environment.persistToken) return;
    if (token) {
      sessionStorage.setItem(environment.tokenStorageKey, token);
    } else {
      sessionStorage.removeItem(environment.tokenStorageKey);
    }
  }

  private readStoredToken(): string | null {
    if (!environment.persistToken) return null;
    return sessionStorage.getItem(environment.tokenStorageKey);
  }
}
