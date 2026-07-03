# Unit 7 — Business Rules

Authoritative business rules for the Dashboards & Notifications unit. Each rule cites the
originating story and maps to its enforcement point. Decisions reflect the all-A approval of
the U7 batched plan.

Rule prefixes:
- **BR-N** Notifications (lifecycle, fan-out, read state, idempotence)
- **BR-DH** Dashboard scoping (per-role visibility)
- **BR-AP** Admin Pipeline (filter / sort / pagination semantics)
- **BR-QSA** Admin quality-score revise (carry-forward from U5 BR-QS3)

---

## BR-N — Notifications

### BR-N1 — Persistence wraps the U1 mock (US-7.8)
- The U1 `NotificationGateway.send(payload)` method is the existing fire-point. U7 wraps it
  with a thin `NotificationsService.fire(event, ctx)` that:
  1. Calls `resolveRecipients(event, ctx)` — pure FL-15 subject (BR-N3).
  2. For each resolved recipient, inserts a `notification` row.
  3. Continues calling the U1 `NotificationGateway.send(payload)` once per recipient (or once
     for the originating event, when no recipient is resolvable) for backward-compat console-
     mock visibility.
- Existing call sites in U1 (invitation flow), U3 (registration confirmation), and U5
  (review-submitted, review-returned, reviewer-assigned) are migrated to call
  `NotificationsService.fire` with the canonical event shape. The legacy
  `NotificationGateway.send` direct calls remain available for non-event log-style messages
  (none currently outside of these call sites).

### BR-N2 — Event kinds shipped this build (US-7.8)
- Six values on the `NotificationKind` enum: `INVITATION_SENT`, `REGISTRATION_CONFIRMED`,
  `REVIEW_SUBMITTED`, `REVIEW_RETURNED`, `PORTFOLIO_BATCH_COMPLETED`, `REVIEWER_ASSIGNED`.
- Adding a new kind is a localized FE+BE change: extend the enum, add a recipient-resolver
  rule, and add the renderer in the FE bell + page. No schema migration.
- AI-related events (FR-6 / FR-8) are deliberately **out of scope** this unit; they ship in
  U8 with the AI feature.

### BR-N3 — Recipient resolution is pure (FL-15)
- `resolveRecipients(event, ctx): RecipientPlan` is a pure function in
  `src/notifications/recipients/recipient-resolver.ts` — no Nest imports, no I/O. The
  `NotificationsService.fire` orchestrator gathers `ctx` (membership lookups, owner emails,
  resolved users) **before** calling the resolver.
- Per-kind rules (the FL-15 PBT-01 invariant):
  | Kind | Recipients |
  |---|---|
  | `INVITATION_SENT` | The invited user (when an account exists at fire time). When the invited email maps to no user, only the legacy U1 mock fires (no `notification` row). |
  | `REGISTRATION_CONFIRMED` | Project's PT/GR members + project owner (if `ownerEmail` resolves to a registered user). |
  | `REVIEW_SUBMITTED` | All PT + GR members on the project. |
  | `REVIEW_RETURNED` | All PT + GR members on the project. |
  | `PORTFOLIO_BATCH_COMPLETED` | All PT + GR members on the **anchor** project. |
  | `REVIEWER_ASSIGNED` | Only the assigned Reviewer. |
- Admin (`GlobalRole.ADMIN`) is **not** auto-recipient — admins read everything via the admin
  pipeline. This keeps the resolver free of role-elevation side effects.
- Reviewers are **not** auto-recipients of `REVIEW_SUBMITTED` / `REVIEW_RETURNED` — they see
  these via the U5 review page and the new reviewer dashboard, not via the bell.

### BR-N4 — Idempotence within a fire (US-7.8)
- The resolver computes a stable `eventKey` per `(kind, contextSubject, recipientUserId)`,
  e.g. `'review-submitted:<reviewId>:<userId>'`. The persistence step deduplicates by
  `eventKey` within the same fire (in-memory `Set`) before issuing inserts.
- DB-level uniqueness is **deferred** this build (BR-N7 forward-compat). No constraint on
  `(eventKey, recipientUserId)` is added.

### BR-N5 — Read state is per recipient (US-7.8)
- `Notification.readAt` is set when the recipient calls `markRead(notificationId)`.
- `markAllRead()` sets `readAt = NOW()` for every row matching `recipientUserId = actor` AND
  `readAt IS NULL` in a single SQL statement.
- `unreadCount(userId)` = `count(notification WHERE recipientUserId = userId AND readAt IS
  NULL)`. PBT-01 target **FL-16**.

### BR-N6 — RBAC on notification routes (NFR-5.1)
- `GET /api/v1/notifications` — actor-scoped (rows where `recipientUserId = actor`); pagination
  via `?limit=&cursor=`. Admin sees their own only (admins use the pipeline).
- `GET /api/v1/notifications/unread-count` — actor-scoped.
- `POST /api/v1/notifications/:id/read` — actor only (404 when row doesn't belong to them).
- `POST /api/v1/notifications/read-all` — actor-scoped batch.

### BR-N7 — Forward-compat (out of scope this build)
- Real delivery channels (email/SMS/push). `recipientEmail` is captured but not used.
- Per-user per-kind opt-out preferences.
- Cross-process dedupe via DB unique constraint on `(eventKey, recipientUserId)`.
- WebSocket/SSE push. Bell uses 30 s polling.

---

## BR-DH — Dashboard scoping

### BR-DH1 — Role auto-selection (US-10.1..10.4)
- `/dashboard` resolves to the most-privileged view available to the user:
  1. `GlobalRole.ADMIN` → `/dashboard/admin`.
  2. else, any active `REVIEWER` membership → `/dashboard/reviewer`.
  3. else, any active `GREEN_RATER` membership → `/dashboard/green-rater`.
  4. else → `/dashboard/project`.
- Each per-role route remains directly addressable. The route guard returns 403 when the user
  lacks any qualifying membership for the requested view (e.g. a PT-only user opening
  `/dashboard/admin` is redirected to `/forbidden`).

### BR-DH2 — Project Team dashboard (US-10.1)
- `GET /api/v1/dashboards/project` (auth-required). Returns
  `ProjectDashboardItemDto[]` where the actor has an active `PROJECT_TEAM` membership.
- `outstandingActions` are computed pure-side from the joined data, in this priority order:
  1. `AGREEMENT_UNSIGNED` — no `certification_agreement` row for project.
  2. `INVOICE_UNPAID` — `invoice.paidAt IS NULL`.
  3. `PRELIM_NOT_SUBMITTED` — `Project.status = REGISTERED` AND no `Review` rows.
  4. `REVIEW_AWAITING_ACCEPT` — latest `Review.status = RETURNED` AND outcome `PASSED |
     PASSED_WITH_ISSUES` AND `Project.status != CERTIFIED`.
  5. `WORKBOOK_PROGRESS_LOW` — < 25 % of attempted credits have a submittal yet (advisory).

### BR-DH3 — Green Rater dashboard (US-10.2)
- `GET /api/v1/dashboards/green-rater` (auth-required). Returns
  `GreenRaterDashboardItemDto[]` where the actor has `GREEN_RATER` membership.
- Adds `workbookProgress` (BR-DH3 metrics: `creditsAttempted`, `creditsWithSubmittal`,
  `creditsWithGreenRaterNote`, `totalAttempted`) computed via SQL aggregations.
- `latestQualityScore` is read-only here (Reviewer/Admin own writes per U5 BR-QS3).

### BR-DH4 — Reviewer dashboard (US-10.3)
- `GET /api/v1/reviews/assigned` (Reviewer membership OR Admin). Returns
  `ReviewerDashboardDto` grouped by `Review.status`. Admin sees all reviews; non-admin
  sees reviews on projects where they have an active `REVIEWER` membership.
- Each item includes `scorecardRollup` so the reviewer can scan progress without opening the
  review page.

---

## BR-AP — Admin Pipeline

### BR-AP1 — Admin-only access (US-10.4 / NFR-5.1)
- `GET /api/v1/admin/pipeline` requires `GlobalRole.ADMIN`. Non-admins receive 403.

### BR-AP2 — Filter + sort semantics (US-10.4)
- Query params: `status`, `phase`, `assignedReviewerId`, `gbciDisplayIdContains`, `limit`
  (default 50, max 200), `cursor`.
- `phase` filter applies to the **latest** `Review` row per project.
- `assignedReviewerId` filter selects projects where the user has an active
  `(projectId, projectRole=REVIEWER)` membership.
- `gbciDisplayIdContains` is a case-insensitive substring match on `gbci_display_id`.
- Sort: stable by `(project.createdAt DESC, project.id DESC)`.
- PBT-01 target **FL-17**: pure `applyPipelineFilters(rows, filter)` is monotone — adding a
  filter never increases the row set.

### BR-AP3 — Cursor pagination (US-10.4)
- Cursor format: opaque base64 of `${createdAt-iso}|${id}`. Pagination predicate:
  `(p.created_at, p.id) < (cursorCreatedAt, cursorId)`.
- `nextCursor` is `null` when fewer than `limit + 1` rows match (the BE fetches `limit + 1`
  to detect end-of-stream cheaply).

---

## BR-QSA — Admin Quality-Score Revise (carry-forward)

### BR-QSA1 — Reuse the existing U5 endpoint (US-10.5)
- The U5 `PUT /api/v1/projects/:projectId/reviews/:reviewId/quality-score` endpoint already
  accepts Admin (per U5 `BR-QS3`). U7 adds **frontend only**:
  - "Quality scores" sub-tab on the admin pipeline page.
  - Inline edit form (score 0..5 + notes textarea).
  - Audit is recorded by the existing `QualityScoreService` — no change required.

### BR-QSA2 — Visibility (US-10.5)
- The admin tab lists all `submittal_quality_score` rows, latest per `(projectId, reviewId)`.
  Server-side: reuse `GET /api/v1/projects/:projectId/quality-scores` per-row (FE issues per-
  project lookups as the user paginates), or the FE consumes the `latestQualityScore` field
  embedded in `PipelineRowDto` (preferred — already aggregated server-side for the pipeline).

---

## BR-Z — State-lock interplay (no change)

- Notifications fire independently of project state. The U5 `StateLockService` is unaffected.
- Dashboard reads are never blocked by state-lock (reads always allowed).
- Admin pipeline writes (assign reviewer, edit quality score) flow through the existing U5
  endpoints, which already participate in the U5 BR-Z carry-forward.

---

## Story → Rule traceability

| Story | Rules |
|---|---|
| US-7.8 Workflow notifications (mocked) | BR-N1, BR-N2, BR-N3, BR-N4, BR-N5, BR-N6 |
| US-10.1 Project dashboard | BR-DH1, BR-DH2 |
| US-10.2 Green Rater dashboard | BR-DH1, BR-DH3 |
| US-10.3 Reviewer dashboard | BR-DH1, BR-DH4 |
| US-10.4 Admin pipeline + assignment | BR-DH1, BR-AP1, BR-AP2, BR-AP3 |
| US-10.5 Admin revise quality score | BR-QSA1, BR-QSA2 (FE-only — BE already done in U5) |
| Cross-cutting RBAC | BR-N6, BR-AP1, BR-DH1 |
| Cross-cutting audit | BR-N1 (write logs the fan-out), BR-QSA1 (existing U5 audit) |

---

## PBT-01 properties summary (full subjects in `business-logic-model.md`)

- **FL-15** Recipient fan-out invariant (BR-N3). Pure subject:
  `resolveRecipients(event, ctx): RecipientPlan`.
- **FL-16** Unread-count invariant (BR-N5). Subject:
  `NotificationsService.unreadCount(userId)` after any sequence of `fire`, `markRead(id)`,
  `markAllRead()` calls.
- **FL-17** Pipeline-filter idempotence (BR-AP2). Pure subject:
  `applyPipelineFilters(rows, filter): rows`.
