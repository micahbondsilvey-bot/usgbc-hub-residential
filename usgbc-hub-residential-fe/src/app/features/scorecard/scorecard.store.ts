import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import {
  ProjectRole,
  RatingSystemDto,
  ScorecardEntryDto,
  UpdateScorecardEntryRequest,
  WarningColumn,
} from '../../core/api/dto';
import { compute } from './scorecard-summary.calc';

interface MeRoleState {
  role: ProjectRole | null;
  isAdmin: boolean;
}

/**
 * Signal-based scorecard feature store (Q11=A). Holds the catalog + entries for
 * one project and recomputes the summary locally for instant feedback. Entry
 * state is mirrored to sessionStorage keyed by projectId.
 */
@Injectable({ providedIn: 'root' })
export class ScorecardStore {
  private readonly api = inject(ApiClient);

  readonly projectId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly catalog = signal<RatingSystemDto | null>(null);
  readonly entries = signal<Map<string, ScorecardEntryDto>>(new Map());
  readonly meRole = signal<MeRoleState>({ role: null, isAdmin: false });
  readonly pendingWrites = signal<Set<string>>(new Set());
  readonly errorMessage = signal<string | null>(null);

  readonly summary = computed(() => {
    const catalog = this.catalog();
    if (!catalog) return null;
    return compute([...this.entries().values()], {
      categories: catalog.categories,
      certificationLevels: catalog.certificationLevels,
    });
  });

  async loadFor(projectId: string): Promise<void> {
    this.projectId.set(projectId);
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.restoreFromSession(projectId);
      const [catalog, scorecard, meRole] = await Promise.all([
        firstValueFrom(this.api.getRatingSystem('leed_v4_1_sf')),
        firstValueFrom(this.api.getScorecard(projectId)),
        firstValueFrom(this.api.meRole(projectId)),
      ]);
      this.catalog.set(catalog);
      this.entries.set(new Map(scorecard.entries.map((e) => [e.creditId, e])));
      this.meRole.set({ role: meRole.projectRole, isAdmin: false });
      this.persistToSession(projectId);
    } catch {
      this.errorMessage.set('Could not load the scorecard.');
    } finally {
      this.loading.set(false);
    }
  }

  canWrite(column: WarningColumn): boolean {
    const { role, isAdmin } = this.meRole();
    if (isAdmin) return true;
    switch (column) {
      case 'attempted':
        return role === 'PROJECT_TEAM' || role === 'GREEN_RATER';
      case 'verified':
        return role === 'GREEN_RATER';
      case 'awarded':
        return role === 'REVIEWER';
      default:
        return false;
    }
  }

  canToggleAttempted(): boolean {
    const { role, isAdmin } = this.meRole();
    return isAdmin || role === 'PROJECT_TEAM' || role === 'GREEN_RATER';
  }

  async attempt(creditId: string): Promise<void> {
    await this.write(creditId, { attempted: true });
  }

  async unattempt(creditId: string): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;
    this.markPending(creditId, true);
    try {
      const entry = await firstValueFrom(this.api.unAttemptCredit(projectId, creditId));
      this.applyEntry(entry);
    } catch {
      this.errorMessage.set('Could not update the credit.');
    } finally {
      this.markPending(creditId, false);
    }
  }

  async setPoint(creditId: string, column: WarningColumn, value: number): Promise<void> {
    const patch: UpdateScorecardEntryRequest = {};
    if (column === 'attempted') patch.attemptedPoints = value;
    if (column === 'verified') patch.verifiedPoints = value;
    if (column === 'awarded') patch.awardedPoints = value;
    await this.write(creditId, patch);
  }

  async selectTier(creditId: string, selectedPointValueId: string): Promise<void> {
    await this.write(creditId, { selectedPointValueId });
  }

  private async write(creditId: string, patch: UpdateScorecardEntryRequest): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;
    this.markPending(creditId, true);
    this.errorMessage.set(null);
    try {
      const res = await firstValueFrom(
        this.api.updateScorecardEntry(projectId, creditId, patch),
      );
      this.applyEntry(res.entry);
    } catch {
      this.errorMessage.set('Could not save your change.');
    } finally {
      this.markPending(creditId, false);
    }
  }

  private applyEntry(entry: ScorecardEntryDto): void {
    const next = new Map(this.entries());
    next.set(entry.creditId, entry);
    this.entries.set(next);
    const projectId = this.projectId();
    if (projectId) this.persistToSession(projectId);
  }

  private markPending(creditId: string, on: boolean): void {
    const next = new Set(this.pendingWrites());
    if (on) next.add(creditId);
    else next.delete(creditId);
    this.pendingWrites.set(next);
  }

  private sessionKey(projectId: string): string {
    return `gbci.scorecard.${projectId}`;
  }

  private persistToSession(projectId: string): void {
    try {
      const payload = JSON.stringify([...this.entries().values()]);
      sessionStorage.setItem(this.sessionKey(projectId), payload);
    } catch {
      // best-effort cache; ignore quota/serialization errors
    }
  }

  private restoreFromSession(projectId: string): void {
    try {
      const raw = sessionStorage.getItem(this.sessionKey(projectId));
      if (!raw) return;
      const list = JSON.parse(raw) as ScorecardEntryDto[];
      this.entries.set(new Map(list.map((e) => [e.creditId, e])));
    } catch {
      // ignore corrupt cache
    }
  }
}
