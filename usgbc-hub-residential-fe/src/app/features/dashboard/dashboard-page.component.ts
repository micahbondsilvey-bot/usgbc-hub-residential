import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import {
  AdminPipelinePageDto,
  DashboardItemDto,
  ReviewerDashboardDto,
} from '../../core/api/dto';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="wrap">
      <h1>Dashboard</h1>

      @if (isAdmin() && pipeline(); as p) {
        <div class="card">
          <h2>Admin pipeline</h2>
          <table>
            <thead><tr><th>GBCI ID</th><th>Name</th><th>Status</th><th>Awarded</th><th>Review</th><th>Reviewer</th></tr></thead>
            <tbody>
              @for (row of p.rows; track row.id) {
                <tr>
                  <td>{{ row.gbciDisplayId ?? '—' }}</td>
                  <td><a [routerLink]="['/projects', row.id]">{{ row.name }}</a></td>
                  <td>{{ row.status }}</td>
                  <td>{{ row.awardedTotal }}</td>
                  <td>{{ row.latestReview?.status ?? '—' }} {{ row.latestReview?.outcome ?? '' }}</td>
                  <td>{{ row.assignedReviewer?.email ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (reviewerHasItems()) {
        <div class="card">
          <h2>Assigned reviews</h2>
          @for (bucket of reviewerBuckets(); track bucket.key) {
            @if (bucket.items.length) {
              <h3>{{ bucket.key }}</h3>
              <ul>
                @for (it of bucket.items; track it.review.id) {
                  <li>
                    <a [routerLink]="['/projects', it.project.id, 'review']">
                      {{ it.review.displayId }} — {{ it.project.name }}
                    </a>
                    · awarded {{ it.scorecardRollup.awardedTotal }}
                  </li>
                }
              </ul>
            }
          }
        </div>
      }

      @if (projectItems().length) {
        <div class="card">
          <h2>My projects (Project Team)</h2>
          @for (item of projectItems(); track item.project.id) {
            <div class="item">
              <a [routerLink]="['/projects', item.project.id]"><strong>{{ item.project.name }}</strong></a>
              <span class="hint">{{ item.project.status }} · awarded {{ item.awardedTotal }}</span>
              @for (action of item.outstandingActions; track $index) {
                <span class="action">{{ action['kind'] }}</span>
              }
            </div>
          }
        </div>
      }

      @if (greenRaterItems().length) {
        <div class="card">
          <h2>My projects (Green Rater)</h2>
          @for (item of greenRaterItems(); track item.project.id) {
            <div class="item">
              <a [routerLink]="['/projects', item.project.id, 'workbook']"><strong>{{ item.project.name }}</strong></a>
              <span class="hint">
                {{ item.workbookProgress?.creditsWithSubmittal }}/{{ item.workbookProgress?.creditsAttempted }} credits with submittals
                @if (item.latestQualityScore) { · QS {{ item.latestQualityScore.score }}/5 }
              </span>
            </div>
          }
        </div>
      }

      @if (empty()) {
        <p class="hint">Nothing to show yet. Register a project to get started.</p>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 960px; margin: 1.5rem auto; padding: 0 1rem; }
      .card { background: #fff; border: 1px solid var(--usgbc-border); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 0.45rem 0.7rem; text-align: left; border-bottom: 1px solid var(--usgbc-border); }
      .item { display: flex; gap: 0.6rem; align-items: center; padding: 0.35rem 0; flex-wrap: wrap; }
      .action { font-size: 0.7rem; background: #fff2cc; color: #7a5b00; border-radius: 4px; padding: 0.1rem 0.4rem; }
      h3 { margin: 0.5rem 0 0.25rem; color: var(--usgbc-muted); font-size: 0.8rem; }
    `,
  ],
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  readonly projectItems = signal<DashboardItemDto[]>([]);
  readonly greenRaterItems = signal<DashboardItemDto[]>([]);
  readonly reviewer = signal<ReviewerDashboardDto | null>(null);
  readonly pipeline = signal<AdminPipelinePageDto | null>(null);

  readonly isAdmin = computed(() => this.auth.isAdmin());
  readonly reviewerBuckets = computed(() =>
    Object.entries(this.reviewer()?.buckets ?? {}).map(([key, items]) => ({ key, items })),
  );
  readonly reviewerHasItems = computed(() =>
    this.reviewerBuckets().some((b) => b.items.length > 0),
  );
  readonly empty = computed(
    () =>
      this.projectItems().length === 0 &&
      this.greenRaterItems().length === 0 &&
      !this.reviewerHasItems() &&
      !(this.isAdmin() && (this.pipeline()?.rows.length ?? 0) > 0),
  );

  async ngOnInit(): Promise<void> {
    const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const [pt, gr, rev] = await Promise.all([
      safe(firstValueFrom(this.api.getProjectDashboard())),
      safe(firstValueFrom(this.api.getGreenRaterDashboard())),
      safe(firstValueFrom(this.api.getReviewerDashboard())),
    ]);
    if (pt) this.projectItems.set(pt.items as DashboardItemDto[]);
    if (gr) this.greenRaterItems.set(gr.items as DashboardItemDto[]);
    if (rev) this.reviewer.set(rev);

    if (this.isAdmin()) {
      const pipe = await safe(firstValueFrom(this.api.getAdminPipeline({ limit: '50' })));
      if (pipe) this.pipeline.set(pipe);
    }
  }
}
