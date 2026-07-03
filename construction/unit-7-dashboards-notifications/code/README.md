# Unit 7 — Dashboards & Notifications — Code

Implements US-7.8, US-10.1, US-10.2, US-10.3, US-10.4, US-10.5 with the documented dual-stage
skip deviation (NFR Requirements + NFR Design skipped per the carry-forward cadence). Tests
deferred per the documented PBT deviation (PBT-01 properties FL-15/16/17 identified; PBT-02..08
+ PBT-10 deferred).

---

## Files

### Backend (`usgbc-hub-residential-be/`)

**New module — `src/notifications/`**:
- `enums/notification.enums.ts` — `NotificationKind` (6 values).
- `notification.entity.ts` — `notification` table (per-recipient).
- `dto/notification.dto.ts` — `NotificationDto`, `NotificationsPageDto`, `UnreadCountDto`.
- `recipients/recipient-resolver.ts` — pure `resolveRecipients` (FL-15).
- `recipients/body-markdown.builder.ts` — pure `buildSubjectAndBody` per kind.
- `notifications.service.ts` — `fire`, `listForRecipient`, `getRecent`, `markRead`,
  `markAllRead`, `unreadCount`. Wraps the U1 `NotificationGateway` for forward-compat.
- `notifications.controller.ts` — five routes under `/api/v1/notifications`.
- `notifications.module.ts` — exports `NotificationsService`.

**New module — `src/admin/`**:
- `pipeline/pipeline-filter.ts` — pure `applyPipelineFilters` (FL-17).
- `pipeline/dto/pipeline-row.dto.ts`, `dto/admin-pipeline-page.dto.ts`.
- `pipeline/admin-pipeline.service.ts` — server-side filter + cursor pagination + LATERAL
  joins for latest review / latest score / assigned reviewer / scorecard rollup.
- `pipeline/admin-pipeline.controller.ts` — `GET /api/v1/admin/pipeline` (Admin only).
- `admin.module.ts`.

**New module — `src/dashboards/`**:
- `dto/dashboard.dto.ts` — `ProjectDashboardDto`, `GreenRaterDashboardDto`,
  `OutstandingActionDto`, `WorkbookProgressDto`.
- `dashboards.service.ts` — per-role aggregation (BR-DH2 outstanding actions, BR-DH3
  workbook progress).
- `dashboards.controller.ts` — `GET /api/v1/dashboards/{project,green-rater}`.
- `dashboards.module.ts`.

**New file — `src/review/reviewer-dashboard.controller.ts`** (sibling to `ReviewController`):
- `GET /api/v1/reviews/assigned` (Reviewer membership OR Admin), grouped by `Review.status`.

**Modified files (BR-N1 / BR-N3 fire-point migrations)**:
- `src/membership/invitation.service.ts` — fires `INVITATION_SENT` when invitee already has
  an account.
- `src/membership/membership.module.ts` — imports `NotificationsModule`.
- `src/projects/registration.orchestrator.ts` — fires `REGISTRATION_CONFIRMED` post-commit.
- `src/projects/projects.module.ts` — imports `NotificationsModule`.
- `src/review/submission.orchestrator.ts` — fires `REVIEW_SUBMITTED` post-commit.
- `src/review/review.orchestrator.ts` — fires `REVIEW_RETURNED` post-commit.
- `src/review/reviewer-assignment.service.ts` — fires `REVIEWER_ASSIGNED` post-commit;
  rewritten to inject `ProjectsService` + `NotificationsService`.
- `src/review/review.module.ts` — imports `NotificationsModule`, registers
  `ProjectMembership`, adds `ReviewerDashboardController`.
- `src/portfolio/portfolio-submission.orchestrator.ts` — fires
  `PORTFOLIO_BATCH_COMPLETED` after batch completes (success or partial).
- `src/portfolio/portfolio.module.ts` — imports `NotificationsModule`.
- `src/app.module.ts` — registers `Notification` entity + imports the three new modules.

### Frontend (`usgbc-hub-residential-fe/`)

**New shell — `src/app/shared/notifications-bell/`**:
- `notifications-bell.component.ts` — `<gbci-notifications-bell>` with `matBadge` count +
  Material menu dropdown + 30 s polling. Mounted in `app.component`.

**New feature — `src/app/features/notifications/`**:
- `notifications.store.ts` — signal-backed; polling, recent, page, mark-read.
- `notifications-page.component.ts` — full page at `/notifications`.

**New feature — `src/app/features/dashboards/`**:
- `dashboards.store.ts` — Project / Green Rater / Reviewer stores (one signal each).
- `admin-pipeline.store.ts` — pipeline rows + filter (debounced 250 ms) + cursor.
- `dashboard-redirect.component.ts` — `/dashboard` resolves to highest-privilege view.
- `dashboard-project-page.component.ts` — `/dashboard/project`.
- `dashboard-green-rater-page.component.ts` — `/dashboard/green-rater`.
- `dashboard-reviewer-page.component.ts` — `/dashboard/reviewer` (tabbed by review status).
- `dashboard-admin-page.component.ts` — `/dashboard/admin` with Pipeline + Quality scores
  tabs.
- `assign-reviewer.dialog.component.ts` — used by admin pipeline.
- `edit-quality-score.dialog.component.ts` — used by admin pipeline (reuses U5 endpoint).

**Modified files**:
- `src/app/core/api/dto.ts` — U7 DTOs (notifications + dashboards + pipeline).
- `src/app/core/api/api-client.ts` — 8 new methods.
- `src/app/app.component.ts` — top-bar gets a "Dashboard" link and the bell shell.
- `src/app/app.routes.ts` — 6 new lazy routes.

---

## Endpoints (quick reference)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/notifications` | Cursor-paginated list of my notifications |
| `GET` | `/api/v1/notifications/recent` | Top 10 newest for the bell |
| `GET` | `/api/v1/notifications/unread-count` | `{ unreadCount }` |
| `POST` | `/api/v1/notifications/:id/read` | Mark one read |
| `POST` | `/api/v1/notifications/read-all` | Mark every unread read |
| `GET` | `/api/v1/dashboards/project` | Project Team dashboard |
| `GET` | `/api/v1/dashboards/green-rater` | Green Rater dashboard |
| `GET` | `/api/v1/reviews/assigned` | Reviewer dashboard (grouped by status) |
| `GET` | `/api/v1/admin/pipeline` | Admin-only pipeline (filterable, cursor-paginated) |

The U5 endpoints `POST /api/v1/projects/:id/reviewers` (assign reviewer) and
`PUT /api/v1/projects/:id/reviews/:rid/quality-score` (revise score) are reused by the
admin pipeline FE. The admin shortcut already accepts Admin per U5 BR-QS3 — no BE change
in U7.

---

## DDL added (Postgres)

A new TypeORM-managed table `notification` (`synchronize: true` creates the columns plus the
`notification_kind_enum` ENUM type and the two indexes declared on the entity). No new
sequences; UUID PKs.

---

## Smoke test (against running BE :3000 / FE :4200)

Verified scenarios as Admin actor (login as `admin@residential.test` / `Admin123!`):

| # | Scenario | Result |
|---|---|---|
| 1 | `GET /notifications/unread-count` | `{ "unreadCount": 0 }` (fresh DB) |
| 2 | `GET /admin/pipeline?limit=3` | Returns 3 enriched rows with `attemptedTotal`, `awardedTotal`, `latestReview`, `latestQualityScore`, `assignedReviewer`. Pagination `nextCursor` works. |
| 3 | `GET /reviews/assigned` (Admin) | Returns all reviews grouped by status; empty buckets render as `[]`. |
| 4 | `GET /dashboards/project` | Returns my projects with `outstandingActions` chips. |
| 5 | BE startup logs | All 6 new routes mapped (notifications + dashboards + admin/pipeline + reviews/assigned). All 9 prior-unit routes still mapped. `notification` entity registered; FK + CHECK constraints from U6 still applied. |
| 6 | FE build | `dashboard-*-page-component`, `notifications-page-component` lazy chunks generated. Initial bundle 162.35 kB gzip; `notifications-bell` adds ~2 kB to main. |

PBT-01 properties (FL-15 / FL-16 / FL-17) implemented as pure / test-friendly subjects:
- `recipient-resolver.ts` exports `resolveRecipients` (no Nest imports).
- `pipeline-filter.ts` exports `applyPipelineFilters` (no Nest imports).
- `notifications.service.ts.unreadCount` is the FL-16 subject.

---

## Known interactions (pre-existing, not introduced by U7)

- The U3 `ProjectsDemoSeeder.upsertProject` continues to reset `existing.status =
  ProjectStatus.REGISTERED` on every boot (documented in U6 README). U7 events do not
  themselves trigger seed-time issues.
- The U1 `NotificationGateway.send` only knows four legacy `kind`s
  (`invite`, `password-reset`, `email-verification`, `registration-confirmation`). The U7
  `NotificationsService` maps non-legacy kinds to `'registration-confirmation'` for the
  console-mock path so backward-compat logging continues to work without touching the U1
  module.

---

## PBT compliance (Unit 7)

- **PBT-01** Property identification — COMPLIANT. Three properties documented with pure /
  test-friendly subjects:
  - **FL-15** Recipient fan-out invariant (pure).
  - **FL-16** Unread-count invariant.
  - **FL-17** Pipeline-filter idempotence (pure).
- **PBT-09** Framework selection — COMPLIANT (fast-check carried over).
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per the U1 precedent;
  subjects remain test-friendly for when tests are enabled).
