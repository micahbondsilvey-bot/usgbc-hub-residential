# Unit 7 — Dashboards & Notifications — Batched Design Plan

**Cadence note (carried forward from U3/U4/U5/U6).** Per user direction:
- **NFR Requirements stage SKIPPED for U7.** No new infra (no new provider seam this build —
  notifications continue to use the U1 `NotificationGateway` mock plus a thin DB persistence
  wrapper; no real email delivery; no new Redis usage; no new sequences).
- **NFR Design stage SKIPPED for U7.** All cross-cutting NFR concerns (Angular 20.2 / Node
  20.19, NestJS, PostgreSQL, Redis-backed throttler, fast-check, ≥100 PBT runs, WCAG 2.1 AA,
  audit, RBAC, request-context, mock notifications, hooks registry from U4, state-lock from
  U5, portfolio dashboard pattern from U6) inherit unchanged.
- **What U7 will produce:** Functional Design (4 artifacts) + Code Generation Plan in one
  approval-gated wave, then code execution. PBT-01 properties identified for the recipient
  fan-out, unread-count semantics, and pipeline-filter idempotence.

---

## Stories in scope (per `unit-of-work.md`)

| Story | Title | Notes |
|---|---|---|
| US-7.8 | Workflow notifications (mocked delivery) | New `Notification` entity + bell icon + read/unread; wraps U1 `NotificationGateway` so every fire also persists per-recipient. |
| US-10.1 | Project (Project Team) dashboard | "My projects" with status, outstanding actions (unsigned agreement, unpaid invoice, prelim not submitted, returned review awaiting accept). |
| US-10.2 | Green Rater dashboard | "My projects" + workbook progress + submittal counts + my latest quality scores (read-only). |
| US-10.3 | Reviewer dashboard | Reviews assigned to me, grouped by review status. Quick-jump to the U5 review page. |
| US-10.4 | Admin pipeline view + reviewer assignment | All projects across the system with status/phase filters + assign-reviewer shortcut (existing U5 endpoint). |
| US-10.5 | Admin inputs or revises Green Rater quality scores | FE only — reuses the existing U5 `PUT /reviews/:id/quality-score` endpoint (BE already accepts Admin actor). |

Out-of-scope (later units / future builds):
- AI-assisted reviewer pre-review analysis (US-8.1) → U8 Mocked AI.
- AI completeness/consistency check (US-6.1) → U8 Mocked AI.
- MS Bookings link-out (US-7.5) → U9 Mobile/PWA & Scheduling.
- Real notification delivery (email/SMS/push) — out of build per FR-7.9 (mocked delivery).
- Notification preferences / per-user opt-out — deferred.

---

## Architectural decisions inherited (NOT re-asked)

| From | Decision |
|---|---|
| U1-Q1 | Hybrid RBAC: global Admin + per-project roles. `ProjectRolesGuard` continues to protect per-project routes. New admin-only routes use `@Roles(GlobalRole.ADMIN)`. |
| U1 | Mocked `NotificationGateway.send(...)` is the existing fire-point. U7 wraps it with a persistence interceptor — original consumers don't change. |
| U1 | `RequestContext` carries `actorUserId` for audit + recipient resolution. |
| U1 | `AuditStampInterceptor` for HTTP writes; explicit `AuditService.record` on quality-score revisions (already done in U5). |
| U2-Q4 | Last-write-wins; `version: integer` on every persisted row. |
| U3 | `Project` entity with `gbciDisplayId`, `Invoice` (paid / unpaid), `CertificationAgreement`. |
| U5 | `Review` entity (`displayId`, `phase`, `status`, `outcome`), `SubmittalQualityScore` entity. The U5 quality-score endpoint already accepts Admin (BR-QS3) — U7 adds the FE only. |
| U6 | Portfolio anchor + dashboard read-model pattern. The Project dashboard reuses the same project-summary aggregation (attempted/awarded totals, latest review). |

---

## Design questions (10)

> All FD-level. Recommended option in **bold**. An "all-A" reply produces a coherent design.

### Q1 — Notification persistence model (US-7.8)
- A. **New `notification` table, one row per `(recipientUserId, event)`. Fields: `id UUID`,
  `kind ENUM` (see Q2), `recipientUserId UUID`, `subject TEXT`, `bodyMarkdown TEXT`,
  `context JSONB` (event-specific, e.g. `{ projectId, reviewId, phase }`), `link TEXT` (FE
  deep-link), `readAt TIMESTAMP NULL`, `firedAt TIMESTAMP`, plus the standard `AuditBase`
  columns. The U1 `NotificationGateway.send(...)` is wrapped: it now (a) keeps the existing
  console-mock send for backward compat, AND (b) calls a new `NotificationsService.persist
  (...)` which inserts one row per resolved recipient. Read endpoints expose the user's own
  rows + an unread count.**
- B. Persist only the events (a single row per fire); FE computes per-recipient unread state.

### Q2 — Notification event types in scope (US-7.8)
- A. **Six `NotificationKind` values shipped this build:
  - `INVITATION_SENT` — wraps the U1 invitation flow (already fires `NotificationGateway`).
  - `REGISTRATION_CONFIRMED` — wraps the U3 registration confirmation email.
  - `REVIEW_SUBMITTED` — fires from U5 `SubmissionOrchestrator` to project members.
  - `REVIEW_RETURNED` — fires from U5 `ReviewOrchestrator.return` to PT/GR.
  - `PORTFOLIO_BATCH_COMPLETED` — fires from U6 `PortfolioSubmissionOrchestrator` to anchor
    members with summary counts.
  - `REVIEWER_ASSIGNED` — fires from U5 reviewer-assignment shortcut to the assigned reviewer.**
- B. Just `REVIEW_RETURNED` + `REVIEW_SUBMITTED` (smaller scope).

### Q3 — Recipient resolution (US-7.8)
- A. **Pure function `resolveRecipients(event, ctx): RecipientPlan` in
  `src/notifications/recipients/recipient-resolver.ts`. Per-kind rules:
  - `INVITATION_SENT` → invited email/userId only.
  - `REGISTRATION_CONFIRMED` → registrant + project owner email.
  - `REVIEW_SUBMITTED` → all PT/GR members on the project.
  - `REVIEW_RETURNED` → all PT/GR members on the project.
  - `PORTFOLIO_BATCH_COMPLETED` → all PT/GR members on the anchor project.
  - `REVIEWER_ASSIGNED` → only the assigned Reviewer.
  Admin recipients are NOT auto-included; admins read everything via the admin pipeline view.
  This is the PBT-01 target FL-15 subject.**
- B. Static recipient list per event kind; no per-project membership lookup.

### Q4 — Dashboard scope per role (US-10.1..US-10.4)
- A. **Four role-scoped dashboards mounted at `/dashboard/...`:
  - `/dashboard/project` (PT) — my projects with `Project + outstanding-action chips`
    (unsigned agreement, unpaid invoice, prelim not submitted, returned-review awaiting
    accept). Click-through to the project detail or the relevant action.
  - `/dashboard/green-rater` (GR) — same project list **plus** workbook progress
    (% credits attempted; % credits with at least one submittal; % credits with at least one
    GR note) and the latest read-only quality scores per review.
  - `/dashboard/reviewer` (Reviewer) — reviews assigned to me grouped by status
    (`SUBMITTED → DECIDED → CONFIRMED → RETURNED`). Each card jumps to the U5 review page.
  - `/dashboard/admin` (Admin) — pipeline table of every project; filters by status, phase,
    assigned reviewer, gbciDisplayId substring; quick-actions: assign reviewer (reuses U5
    `POST /projects/:id/reviewers`), edit quality score (reuses U5 `PUT /reviews/:id/
    quality-score`).
  Auto-redirect on `/dashboard` to the highest-privilege view available to the user.**
- B. Single unified dashboard that variant-renders sections per role.

### Q5 — Routing & role auto-selection (US-10.1..10.4)
- A. **Single home `/dashboard` route resolves the user's most-privileged view at runtime:
  Admin → `/dashboard/admin`; else if user has any Reviewer membership → `/dashboard/reviewer`;
  else if user has any Green Rater membership → `/dashboard/green-rater`; else
  `/dashboard/project`. Explicit per-role routes are also reachable; FE guards return 403 for
  views the user doesn't have membership/role for. Top-app-bar adds a "Dashboard" link.**
- B. Explicit per-role routes only; user picks one manually.

### Q6 — Admin pipeline endpoint (US-10.4)
- A. **New `GET /api/v1/admin/pipeline` (Admin-only, `@Roles(GlobalRole.ADMIN)`). Server-side
  filter + sort. Query params: `status`, `phase`, `assignedReviewerId`,
  `gbciDisplayIdContains`, `limit` (default 50, max 200), `cursor`. Response:
  `{ rows: PipelineRowDto[], nextCursor: string | null }`. Each row includes:
  `ProjectDto + latestReview + latestQualityScore + portfolioAnchor + assignedReviewerSummary`.
  Cursor is opaque base64 of `(createdAt, id)`. PBT-01 target FL-17.**
- B. Reuse `GET /projects` with admin-mode filters.

### Q7 — Reviewer dashboard endpoint (US-10.3)
- A. **New `GET /api/v1/reviews/assigned` (Reviewer membership OR Admin). Returns reviews
  where the actor has an active `REVIEWER` membership on the project, grouped by
  `Review.status`. Each entry: `Review + ProjectSummary + latestQualityScore +
  scorecardRollup`. Sorted by `submittedAt DESC` within each group. Admin sees all reviews
  across the system (pagination via `?limit=&cursor=`).**
- B. Reuse the existing `/projects/:id/reviews` route + per-project loop on the FE.

### Q8 — Admin quality-score revise (US-10.5) — FE only
- A. **The U5 `PUT /projects/:projectId/reviews/:reviewId/quality-score` endpoint already
  accepts Admin (BR-QS3). U7 adds an FE-only "Quality scores" admin sub-tab on the admin
  pipeline page that lists all scores across the system, with inline edit for `score`
  (`0..5`) and `notes`. Audit is recorded by the existing service. No new BE endpoint.**
- B. New dedicated admin endpoint.

### Q9 — Notification UI (US-7.8)
- A. **Bell icon in the app shell next to the user menu, with an unread-count badge. Tap
  opens a dropdown panel with the 10 most-recent notifications, a "Mark all read" button, and
  a link to the full `/notifications` page. The full page uses Material list with infinite
  scroll. Each row deep-links to the relevant project / review / portfolio. Read state is
  per-recipient, persisted in the new `notification.readAt` column. Polling every 30s while
  the tab is focused; manual refresh button. PBT-01 target FL-16.**
- B. Toast-only (no persistent bell).

### Q10 — PBT-01 invariants for U7
- A. **Three properties, each implemented as a pure / test-friendly subject:
  - **FL-15 Recipient fan-out invariant** — pure
    `resolveRecipients(event, projectMembers, anchorMembers): RecipientPlan` in
    `src/notifications/recipients/recipient-resolver.ts`. Property: for every input event,
    the recipient set equals the per-kind rule's expected set (no false-positives, no
    false-negatives).
  - **FL-16 Unread-count invariant** — `NotificationsService.unreadCount(userId)` after any
    sequence of `fire`, `markRead(id)`, `markAllRead()` calls equals
    `count(notifications where recipientId=userId AND readAt IS NULL)`.
  - **FL-17 Pipeline-filter idempotence** — for any pair of admin-pipeline filter sets `A`
    and `B`, `pipeline(A ∪ B) ⊆ pipeline(A) ∩ pipeline(B)` (additive narrowing). Pure
    subject: `applyPipelineFilters(rows, filter)` in
    `src/admin/pipeline/pipeline-filter.ts`.**
- B. Skip PBT for U7 entirely.

---

## Approval gate

After your answers, I will (one wave):
1. Generate `aidlc-docs/construction/unit-7-dashboards-notifications/functional-design/{
   domain-entities, business-rules, business-logic-model, frontend-components}.md`.
2. Generate `aidlc-docs/construction/plans/unit-7-dashboards-notifications-code-generation-plan.md`.
3. Mark this batched plan checklist complete and update `aidlc-state.md`.

> Tests remain skipped per the U1 PBT deviation. PBT-01 properties for U7:
> - **FL-15** Recipient fan-out invariant (pure).
> - **FL-16** Unread-count invariant.
> - **FL-17** Pipeline-filter idempotence (pure).

---

## Part 2 generation checklist

- [x] FD: `domain-entities.md` — `Notification` table + `NotificationKind` enum +
      `RecipientPlan` DTO + `PipelineRowDto` + `ReviewerDashboardItemDto` + dashboard summary
      DTOs. No new sequence (UUID PK).
- [x] FD: `business-rules.md` — BR-N (notifications: fan-out / mark-read / unread count /
      no-AI-recipient-this-build), BR-DH (per-role dashboard scoping), BR-AP (admin pipeline
      filter semantics), BR-QSA (admin quality-score revise via existing endpoint).
- [x] FD: `business-logic-model.md` — fire path (existing call sites + new wrapper), recipient
      resolver pure function, mark-read flow, dashboard query shapes, admin pipeline
      cursor-pagination, FL-15..FL-17 properties.
- [x] FD: `frontend-components.md` — `features/dashboards/` (4 dashboard pages + role
      auto-selector + pipeline table + assign-reviewer dialog + edit-quality-score dialog),
      `features/notifications/` (bell shell-component + dropdown + full-page list), routes
      + lazy chunks, dto/api-client extensions.
- [x] Plan: `unit-7-dashboards-notifications-code-generation-plan.md` — numbered backend
      (Notification entity + service + controller, recipient-resolver pure module, fire-point
      wrappers in U1/U3/U5/U6, admin pipeline service + controller, reviewer dashboard
      endpoint) + frontend (4 dashboard pages + bell + notification page + route guards) +
      docs + validation; story coverage table (US-7.8, US-10.1..10.5).
- [x] State: mark U7 FD ✅ in `aidlc-state.md`; NFRR/NFRD rows show `— (skipped per user)`.
- [x] Audit: log this batched plan + the user's answers.
