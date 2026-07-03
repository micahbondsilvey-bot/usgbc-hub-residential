import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import {
  ProjectDto,
  ProjectRole,
  ReviewDto,
  ReviewOutcome,
  ReviewPhase,
  SubmittalQualityScoreDto,
} from '../../core/api/dto';

@Component({
  selector: 'app-review-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="wrap">
      <h1>Review</h1>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (project(); as p) {
        <p class="hint">{{ p.name }} · {{ p.gbciDisplayId }} · <strong>{{ p.status }}</strong></p>
      }

      <!-- Submit for review -->
      @if (canSubmit()) {
        <div class="card">
          <h2>Submit for review</h2>
          <select [(ngModel)]="phase">
            <option value="PRELIMINARY">Preliminary</option>
            <option value="FINAL">Final</option>
            <option value="SUPPLEMENTAL">Supplemental</option>
          </select>
          <button class="primary" type="button" (click)="submit()" [disabled]="busy()">
            Submit
          </button>
        </div>
      }

      <!-- Accept / continue -->
      @if (canAccept()) {
        <div class="card">
          <h2>Decision</h2>
          <button class="primary" type="button" (click)="accept()" [disabled]="busy()">
            Accept certification
          </button>
          <button class="link" type="button" (click)="continueNext()" [disabled]="busy()">
            Continue to next phase
          </button>
        </div>
      }

      <!-- Reviews list -->
      @for (r of reviews(); track r.id) {
        <div class="card">
          <div class="review-head">
            <strong>{{ r.displayId }} · {{ r.phase }}</strong>
            <span class="status">{{ r.status }}</span>
            @if (r.outcome) { <span class="outcome">{{ r.outcome }}</span> }
          </div>
          @if (r.awardedTotal !== null) {
            <p class="hint">Awarded {{ r.awardedTotal }} · {{ r.certificationLevel ?? 'no level' }}</p>
          }

          @if (isReviewer() && (r.status === 'SUBMITTED' || r.status === 'DECIDED')) {
            <div class="actions">
              <button class="link" type="button" (click)="awardAll(r)">Award all verified</button>
              <button class="link" type="button" (click)="confirm(r)">Confirm report</button>
            </div>
          }
          @if (isReviewer() && r.status === 'CONFIRMED') {
            <button class="primary" type="button" (click)="doReturn(r)">Return to Green Rater</button>
          }

          @if (isReviewer()) {
            <div class="qs">
              <label>Quality score (0–5)</label>
              <input type="number" min="0" max="5" [(ngModel)]="scoreDraft[r.id]" />
              <button class="link" type="button" (click)="saveScore(r)">Save score</button>
              @if (scoreFor(r.id); as s) { <span class="hint">current: {{ s.score }}</span> }
            </div>
          } @else if (scoreFor(r.id); as s) {
            <p class="hint">Submittal quality score: <strong>{{ s.score }} / 5</strong></p>
          }

          @if (r.reportMarkdown) {
            <details>
              <summary>Review report</summary>
              <pre class="report">{{ r.reportMarkdown }}</pre>
            </details>
          }
        </div>
      }

      @if (!loading() && reviews().length === 0) {
        <p class="hint">No reviews yet.</p>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 820px; margin: 1.5rem auto; padding: 0 1rem; }
      .card { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
      .review-head { display: flex; gap: 0.75rem; align-items: center; }
      .status { font-size: 0.75rem; font-weight: 700; color: var(--usgbc-green-dark); }
      .outcome { font-size: 0.75rem; font-weight: 700; background: var(--usgbc-green); color: #fff; padding: 0.1rem 0.5rem; border-radius: 999px; }
      .actions { display: flex; gap: 1rem; margin: 0.5rem 0; }
      .qs { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
      .qs input { width: 4rem; min-height: 36px; }
      .report { background: var(--usgbc-bg); padding: 0.75rem; border-radius: 6px; overflow: auto; white-space: pre-wrap; font-size: 0.8rem; }
      button.primary { width: auto; padding: 0 1rem; margin-left: 0.5rem; }
      button.link { background: none; border: none; color: var(--usgbc-green-dark); text-decoration: underline; cursor: pointer; font: inherit; }
      select { min-height: 40px; }
    `,
  ],
})
export class ReviewPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly project = signal<ProjectDto | null>(null);
  readonly reviews = signal<ReviewDto[]>([]);
  readonly scores = signal<SubmittalQualityScoreDto[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private readonly role = signal<ProjectRole | null>(null);

  phase: ReviewPhase = 'PRELIMINARY';
  scoreDraft: Record<string, number> = {};
  private projectId = '';

  readonly isAdmin = computed(() => this.auth.isAdmin());

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    await this.reload();
    this.loading.set(false);
  }

  private async reload(): Promise<void> {
    try {
      const [project, reviews, me, scores] = await Promise.all([
        firstValueFrom(this.api.getProject(this.projectId)),
        firstValueFrom(this.api.listReviews(this.projectId)),
        firstValueFrom(this.api.meRole(this.projectId)),
        firstValueFrom(this.api.listQualityScores(this.projectId)),
      ]);
      this.project.set(project);
      this.reviews.set(reviews);
      this.role.set(me.projectRole);
      this.scores.set(scores);
    } catch {
      this.error.set('Could not load review data.');
    }
  }

  isReviewer(): boolean {
    return this.isAdmin() || this.role() === 'REVIEWER';
  }

  isTeam(): boolean {
    return this.isAdmin() || this.role() === 'PROJECT_TEAM' || this.role() === 'GREEN_RATER';
  }

  canSubmit(): boolean {
    return this.isTeam() && this.project()?.status === 'REGISTERED';
  }

  canAccept(): boolean {
    return (
      this.isTeam() &&
      this.reviews().some((r) => r.status === 'RETURNED' && r.outcome !== 'DENIED')
    );
  }

  scoreFor(reviewId: string): SubmittalQualityScoreDto | undefined {
    return this.scores().find((s) => s.reviewId === reviewId);
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.reload();
    } catch {
      this.error.set('That action could not be completed (check state and permissions).');
    } finally {
      this.busy.set(false);
    }
  }

  submit(): Promise<void> {
    return this.run(() => firstValueFrom(this.api.submitReview(this.projectId, this.phase)));
  }

  awardAll(r: ReviewDto): Promise<void> {
    return this.run(() => firstValueFrom(this.api.awardAllVerified(this.projectId, r.id)));
  }

  confirm(r: ReviewDto): Promise<void> {
    const outcome = undefined as ReviewOutcome | undefined; // derived server-side
    return this.run(() => firstValueFrom(this.api.confirmReview(this.projectId, r.id, { outcome })));
  }

  doReturn(r: ReviewDto): Promise<void> {
    return this.run(() => firstValueFrom(this.api.returnReview(this.projectId, r.id)));
  }

  accept(): Promise<void> {
    return this.run(() => firstValueFrom(this.api.acceptCertification(this.projectId)));
  }

  continueNext(): Promise<void> {
    return this.run(() => firstValueFrom(this.api.continueToNextPhase(this.projectId)));
  }

  saveScore(r: ReviewDto): Promise<void> {
    const score = Number(this.scoreDraft[r.id] ?? 0);
    return this.run(() =>
      firstValueFrom(this.api.upsertQualityScore(this.projectId, r.id, score, null)),
    );
  }
}
