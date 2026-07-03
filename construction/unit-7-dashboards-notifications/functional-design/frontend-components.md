# Unit 7 — Frontend Components

Angular 20.2 standalone + Signals + feature-lazy convention (carried forward from
U1..U6). New code lands in three places:
- `usgbc-hub-residential-fe/src/app/features/dashboards/` (4 dashboards + role auto-selector
  + small dialogs).
- `usgbc-hub-residential-fe/src/app/features/notifications/` (full-page list + store).
- `usgbc-hub-residential-fe/src/app/shared/notifications-bell/` (bell button + dropdown
  panel mounted in the app shell).

Plus small extensions to `core/api/dto.ts`, `core/api/api-client.ts`, and `app.routes.ts`.

Decisions reflected (all-A from `unit-7-dashboards-notifications-design-plan.md`):
- Q4=A four role-scoped dashboards.
- Q5=A `/dashboard` auto-selects highest-privilege view.
- Q9=A bell + per-recipient `readAt`.

---

## DTO additions (`core/api/dto.ts`)

```ts
// U7 — Notifications
export type NotificationKind =
  | 'INVITATION_SENT'
  | 'REGISTRATION_CONFIRMED'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_RETURNED'
  | 'PORTFOLIO_BATCH_COMPLETED'
  | 'REVIEWER_ASSIGNED';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  subject: string;
  bodyMarkdown: string;
  context: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  firedAt: string;
  version: number;
}

export interface NotificationsPageDto {
  rows: NotificationDto[];
  nextCursor: string | null;
}

export interface UnreadCountDto {
  unreadCount: number;
}

// U7 — Dashboards
export type OutstandingActionDto =
  | { kind: 'AGREEMENT_UNSIGNED' }
  | { kind: 'INVOICE_UNPAID'; invoiceDisplayId: string; totalCents: number }
  | { kind: 'PRELIM_NOT_SUBMITTED' }
  | {
      kind: 'REVIEW_AWAITING_ACCEPT';
      reviewId: string;
      reviewDisplayId: string;
      phase: ReviewPhase;
      outcome: ReviewOutcome;
    }
  | { kind: 'WORKBOOK_PROGRESS_LOW'; percentAttemptedComplete: number };

export interface ProjectDashboardItemDto {
  project: ProjectDto;
  attemptedTotal: number;
  awardedTotal: number;
  outstandingActions: OutstandingActionDto[];
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
  } | null;
}

export interface ProjectDashboardDto {
  items: ProjectDashboardItemDto[];
}

export interface WorkbookProgressDto {
  creditsAttempted: number;
  creditsWithSubmittal: number;
  creditsWithGreenRaterNote: number;
  totalAttempted: number;
}

export interface GreenRaterDashboardItemDto extends ProjectDashboardItemDto {
  workbookProgress: WorkbookProgressDto;
  latestQualityScore: {
    reviewId: string;
    score: number;
    enteredAt: string;
  } | null;
}

export interface GreenRaterDashboardDto {
  items: GreenRaterDashboardItemDto[];
}

export interface ReviewerDashboardItemDto {
  review: ReviewDto;
  project: {
    id: string;
    gbciDisplayId: string | null;
    name: string;
    status: ProjectStatus;
    isPortfolioAnchor: boolean;
  };
  scorecardRollup: {
    attemptedTotal: number;
    verifiedTotal: number;
    awardedTotal: number;
  };
  latestQualityScore: {
    score: number;
    enteredAt: string;
  } | null;
}

export interface ReviewerDashboardDto {
  buckets: Record<ReviewStatus, ReviewerDashboardItemDto[]>;
}

// U7 — Admin pipeline
export interface PipelineAssignedReviewerDto {
  userId: string;
  name: string | null;
  email: string;
}

export interface PipelineRowDto extends ProjectDto {
  attemptedTotal: number;
  awardedTotal: number;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
    outcome: ReviewOutcome | null;
    submittedAt: string;
    returnedAt: string | null;
  } | null;
  latestQualityScore: {
    reviewId: string;
    score: number;
    enteredAt: string;
    enteredByUserId: string;
  } | null;
  assignedReviewer: PipelineAssignedReviewerDto | null;
}

export interface AdminPipelineFilterDto {
  status?: ProjectStatus;
  phase?: ReviewPhase;
  assignedReviewerId?: string;
  gbciDisplayIdContains?: string;
}

export interface AdminPipelinePageDto {
  rows: PipelineRowDto[];
  nextCursor: string | null;
  filter: AdminPipelineFilterDto;
}
```

---

## ApiClient additions (`core/api/api-client.ts`)

```ts
// Notifications
listNotifications(limit?: number, cursor?: string): Observable<NotificationsPageDto>;
getUnreadCount(): Observable<UnreadCountDto>;
markNotificationRead(id: string): Observable<void>;
markAllNotificationsRead(): Observable<void>;

// Dashboards
getProjectDashboard(): Observable<ProjectDashboardDto>;
getGreenRaterDashboard(): Observable<GreenRaterDashboardDto>;
getReviewerDashboard(): Observable<ReviewerDashboardDto>;

// Admin pipeline
getAdminPipeline(filter: AdminPipelineFilterDto, limit?: number, cursor?: string): Observable<AdminPipelinePageDto>;
```

---

## Stores

### `NotificationsStore` (`features/notifications/notifications.store.ts`)
- Signal-backed.
- `unreadCount: signal<number>`, `recent: signal<NotificationDto[]>` (top 10 for the
  dropdown), `page: signal<NotificationDto[]>` + `nextCursor: signal<string | null>` for the
  full page.
- 30 s polling timer started in `ngOnInit` of the bell component when `document.hasFocus()`;
  paused on `visibilitychange`. Kicks `refreshUnreadCount()`.
- Methods: `loadRecent()`, `loadPage()`, `markRead(id)`, `markAllRead()`,
  `refreshUnreadCount()`.

### `DashboardsStore` (`features/dashboards/dashboards.store.ts`)
- Signal-backed.
- `project: signal<ProjectDashboardDto | null>`, `greenRater`,
  `reviewer: signal<ReviewerDashboardDto | null>`, `loading`, `error`.
- Methods: `loadProject()`, `loadGreenRater()`, `loadReviewer()`.
- Each method is independent so the role auto-selector loads only what the user can see.

### `AdminPipelineStore` (`features/dashboards/admin-pipeline.store.ts`)
- Signal-backed.
- `rows: signal<PipelineRowDto[]>`, `filter: signal<AdminPipelineFilterDto>`,
  `nextCursor`, `loading`, `error`, `selectedRow: signal<PipelineRowDto | null>`.
- Methods: `setFilter(patch)` (resets pagination), `loadMore()`, `assignReviewer(projectId,
  userId)`, `setQualityScore(projectId, reviewId, score, notes)` (reuses existing U5 endpoint).
- Filter changes debounced 250 ms (FE-only, simple `setTimeout`).

---

## Components

All standalone, Material-based, WCAG 2.1 AA aligned.

### `notifications-bell` (shell)
- `src/app/shared/notifications-bell/notifications-bell.component.ts`.
- Renders a `mat-icon-button` with a `matBadge` showing `unreadCount`. Clicking opens
  `MatMenu` with the 10 most-recent notifications, each row shows kind icon + subject + body
  + "X minutes ago" relative time.
- "Mark all as read" button at the bottom of the menu.
- "View all" link routes to `/notifications`.
- Mounted once in `app.component`'s top bar between project breadcrumbs and the user menu.

### `notifications-page` (full page)
- `src/app/features/notifications/notifications-page.component.ts` at `/notifications`.
- Material `<mat-list>` with infinite scroll (loads next page when the bottom sentinel hits
  IntersectionObserver). Each row shows kind icon + subject + body + relative time + "Open"
  router-link button (uses `notification.link`).
- Filter chips at top: "Unread only" toggle, "Kind" multi-select.
- Empty state when no notifications.

### Dashboard pages

Each is its own lazy route under `/dashboard/*`:

- **`dashboard-project-page.component`** at `/dashboard/project`.
  - Material grid of `ProjectDashboardItemDto`. Each card: project name + status chip,
    attempted/awarded mini-bar, outstanding-actions chip list (each chip routes to the
    relevant action), "Open project" button.
  - Empty state with "Register a project" CTA when user has no PT memberships.
- **`dashboard-green-rater-page.component`** at `/dashboard/green-rater`.
  - Same shape as project dashboard plus an extra row of workbook-progress mini-bars and a
    quality-score badge per project.
- **`dashboard-reviewer-page.component`** at `/dashboard/reviewer`.
  - Material `mat-tab-group` with one tab per `ReviewStatus` (`SUBMITTED → DECIDED →
    CONFIRMED → RETURNED`; `OPEN` shown only when non-empty). Each tab body is a list of
    `ReviewerDashboardItemDto` with project name + display ID + phase + scorecard rollup +
    quality-score badge + "Open review" button (routes to `/projects/:id/review`).
- **`dashboard-admin-page.component`** at `/dashboard/admin`.
  - Two sub-views via `mat-tab-group`:
    - **Pipeline tab** — Material table of `PipelineRowDto` with columns: Display ID, Name,
      Status, Phase, Assigned Reviewer, Latest Quality Score, Actions. Filter row above the
      table (`mat-form-field` for `gbciDisplayIdContains`, `mat-select` for status / phase /
      reviewer). Per-row actions: "Open project", "Assign reviewer" (opens
      `assign-reviewer.dialog`), "Edit quality score" (opens `edit-quality-score.dialog`).
      Infinite scroll via cursor pagination.
    - **Quality scores tab** — focused view of rows with `latestQualityScore !== null`,
      sorted by `enteredAt DESC`. Inline edit (BR-QSA1).

### Dialogs

- **`assign-reviewer.dialog.component`** — opens from the admin pipeline row action. Shows a
  user-search autocomplete (filtered to users with `globalRole = 'user'`) and confirm /
  cancel. Calls existing U5 `assignReviewer(projectId, userId)`. After success, refetches the
  pipeline row + updates the row's `assignedReviewer`.
- **`edit-quality-score.dialog.component`** — number-stepper 0..5 + notes textarea. Calls
  existing U5 `saveQualityScore(projectId, reviewId, score, notes)`. After success,
  updates the row's `latestQualityScore`.

### Role auto-selector

`/dashboard` route uses an `Angular ResolveFn` that:
1. Reads `AuthService.profile()`.
2. Fires `getMyRoleOnProject` for any project memberships? Actually simpler: queries the four
   dashboard endpoints in parallel (with safe `.catch(() => null)` so 403s don't crash) and
   redirects to the first non-empty one in priority order: admin → reviewer → green-rater →
   project. When all are empty, lands on `/dashboard/project` with the empty state.

For simplicity in the first ship, the resolver consults `AuthService.isAdmin()` for admin,
then issues a single `GET /reviews/assigned`, `/dashboards/green-rater`, `/dashboards/project`
sequence (server-side filters guarantee a fast 200 with empty results) and redirects on the
first non-empty dataset.

---

## Routes (`app.routes.ts` additions)

```ts
{ path: 'dashboard', canActivate: [authGuard], loadComponent: () =>
    import('./features/dashboards/dashboard-redirect.component').then(m => m.DashboardRedirectComponent) },
{ path: 'dashboard/project', canActivate: [authGuard], loadComponent: () =>
    import('./features/dashboards/dashboard-project-page.component').then(m => m.DashboardProjectPageComponent),
    title: 'My projects — GBCI Certify' },
{ path: 'dashboard/green-rater', canActivate: [authGuard], loadComponent: () =>
    import('./features/dashboards/dashboard-green-rater-page.component').then(m => m.DashboardGreenRaterPageComponent),
    title: 'Green Rater dashboard — GBCI Certify' },
{ path: 'dashboard/reviewer', canActivate: [authGuard], loadComponent: () =>
    import('./features/dashboards/dashboard-reviewer-page.component').then(m => m.DashboardReviewerPageComponent),
    title: 'Reviewer dashboard — GBCI Certify' },
{ path: 'dashboard/admin', canActivate: [authGuard], loadComponent: () =>
    import('./features/dashboards/dashboard-admin-page.component').then(m => m.DashboardAdminPageComponent),
    title: 'Admin pipeline — GBCI Certify' },
{ path: 'notifications', canActivate: [authGuard], loadComponent: () =>
    import('./features/notifications/notifications-page.component').then(m => m.NotificationsPageComponent),
    title: 'Notifications — GBCI Certify' },
```

The default redirect at `''` already targets `/projects`. We add a "Dashboard" link in the
top bar (next to Projects) that goes to `/dashboard`.

---

## Top-app-bar updates

`app.component.ts` shell:
- Adds a "Dashboard" link before the "Projects" link.
- Inserts `<gbci-notifications-bell>` between the user-name + the user menu.
- Bell uses `position="above"` for its dropdown so it doesn't overlap content.

---

## A11y checklist (WCAG 2.1 AA, NFR-7.5)

- Bell button has `aria-label="Notifications, X unread"` (count read by screen readers).
- Dropdown is keyboard-trappable; `Esc` closes; first item gets focus on open.
- Status chips on dashboards pair color + textual label.
- Pipeline table has `<caption>` and `scope="col"` headers; column-filter selects have proper
  labels.
- Empty states use `role="status"` so screen readers announce them.

---

## Loading / error states

- Dashboards: Material skeletons (3 placeholder cards) while loading.
- Notifications: bell shows `0` badge while loading; dropdown shows a small spinner.
- Pipeline: progress bar at top of the table while loading.
- Errors: `<usgbc-empty-state>` with retry button (already exists per U2 conventions).

---

## Bundle impact estimate

- `dashboard-project-page-component`: ~25-35 kB raw.
- `dashboard-green-rater-page-component`: ~30-40 kB raw.
- `dashboard-reviewer-page-component`: ~25-35 kB raw.
- `dashboard-admin-page-component`: ~50-65 kB raw (Material table + 2 dialogs).
- `notifications-page-component`: ~20-25 kB raw.
- Bell shell adds ~5 kB to the main bundle.

Confirmed during code generation.
