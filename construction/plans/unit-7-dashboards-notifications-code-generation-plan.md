# Unit 7 — Dashboards & Notifications — Code Generation Plan

**Cadence**: NFR Requirements + NFR Design SKIPPED for U7 (carried forward from
U3/U4/U5/U6). All cross-cutting NFRs from prior units inherit unchanged. Tests skipped per
the documented PBT deviation (PBT-01 properties FL-15/16/17 identified; PBT-02..08 + PBT-10
deferred).

**Scope**: stories US-7.8, US-10.1, US-10.2, US-10.3, US-10.4, US-10.5 — persistent
notifications wrapping the U1 mock + four role-scoped dashboards + admin pipeline with
filters + admin quality-score revise (FE-only).

**Approach**: Phase A (backend, Steps 1-25) → Phase B (frontend, Steps 26-37) → Phase C
(documentation + validation, Steps 38-45).

---

## Phase A — Backend (Steps 1-25)

### A.1 — Notification entity + DTOs

- [x] **1.** Create `src/notifications/enums/notification.enums.ts` exporting
      `NotificationKind`.
- [x] **2.** Create `src/notifications/notification.entity.ts` with all columns from
      `domain-entities.md` (UUID PK, `kind`, `recipientUserId`, `recipientEmail`, `subject`,
      `bodyMarkdown`, `context jsonb`, `link`, `readAt`, `firedAt`, `version`). Inherits
      `AuditBase`.
- [x] **3.** Create DTOs in `src/notifications/dto/`:
      `notification.dto.ts`, `notifications-page.dto.ts`, `unread-count.dto.ts`.

### A.2 — Pure subjects

- [x] **4.** Create `src/notifications/recipients/recipient-resolver.ts` with the pure
      `resolveRecipients(event, ctx)` function (FL-15). No Nest imports.
- [x] **5.** Create `src/notifications/recipients/body-markdown.builder.ts` with pure
      `buildSubjectAndBody(event)` returning `{ subject, bodyMarkdown, link }` per
      `NotificationKind`.

### A.3 — `NotificationsService`

- [x] **6.** Create `src/notifications/notifications.service.ts`:
      - `fire(event, partialCtx?): Promise<void>` — Flow 1.
      - `listForRecipient(actor, limit, cursor): Promise<NotificationsPageDto>` — Flow 2.
      - `markRead(id, actor): Promise<NotificationDto>`.
      - `markAllRead(actor): Promise<void>` (single SQL update).
      - `unreadCount(actor): Promise<number>`.
      - Inject: `Repository<Notification>`, `Repository<ProjectMembership>`,
        `Repository<User>`, `NotificationGateway` (U1), `Logger`.
- [x] **7.** Inside `fire(...)`, build `RecipientResolutionContext` by issuing minimal
      project-membership + user lookups based on which event keys are present. Centralize in
      a private `gatherContext(event)` helper.
- [x] **8.** Implement `toDto(row)` mapper.

### A.4 — `NotificationsController`

- [x] **9.** Create `src/notifications/notifications.controller.ts` with four routes per
      Flow 2. Use `@CurrentUser()` actor. No `ProjectRolesGuard` — all actor-scoped.
- [x] **10.** Create `src/notifications/notifications.module.ts` exporting
      `NotificationsService` so other modules can call `fire(...)`.

### A.5 — Wire fire-points (call-site migrations per Flow 1 table)

- [x] **11.** Migrate U1 invitation send: `src/membership/invitation.service.ts` —
      replace direct `notificationGateway.send(...)` with
      `notificationsService.fire({ kind: 'INVITATION_SENT', context: { projectId,
      invitationId, projectRole, expiresAt }, resolvedUsers: { invitee: { userId, email } }
      })`. When invitee email maps to no user, fall back to the existing direct mock send
      (no row persisted). Add `NotificationsModule` to `MembershipModule.imports`.
- [x] **12.** Migrate U3 registration confirmation: `src/projects/registration.orchestrator.ts`
      — fire `REGISTRATION_CONFIRMED`. Add `NotificationsModule` to `ProjectsModule.imports`.
- [x] **13.** Migrate U5 review submission: `src/review/submission.orchestrator.ts` post-
      commit — fire `REVIEW_SUBMITTED`. Migrate `src/review/review.orchestrator.ts` `return`
      method — fire `REVIEW_RETURNED`. Migrate `src/review/reviewer-assignment.service.ts`
      — fire `REVIEWER_ASSIGNED` (use `resolvedUsers.reviewer`). Add `NotificationsModule`
      to `ReviewModule.imports`.
- [x] **14.** Migrate U6 portfolio batch: `src/portfolio/portfolio-submission.orchestrator.ts`
      — at the end of `submit(...)` (success or partial), fire
      `PORTFOLIO_BATCH_COMPLETED` with the final summary. Add `NotificationsModule` to
      `PortfolioModule.imports`.

### A.6 — Admin pipeline

- [x] **15.** Create `src/admin/pipeline/pipeline-filter.ts` with the pure
      `applyPipelineFilters(rows, filter)` (FL-17). No Nest imports.
- [x] **16.** Create `src/admin/pipeline/dto/pipeline-row.dto.ts`,
      `admin-pipeline-page.dto.ts`, `admin-pipeline-filter.dto.ts`.
- [x] **17.** Create `src/admin/pipeline/admin-pipeline.service.ts`:
      - `list(filter, limit, cursor): Promise<AdminPipelinePageDto>` — Flow 6.
      - Uses TypeORM QueryBuilder with `LEFT JOIN LATERAL` for latest-review +
        latest-quality-score + assigned-reviewer.
      - Cursor encode/decode helpers.
      - Inject: repos for `Project`, `Review`, `SubmittalQualityScore`,
        `ProjectMembership`, `User`, `ScorecardEntry`, `Logger`.
- [x] **18.** Create `src/admin/pipeline/admin-pipeline.controller.ts` with
      `GET /admin/pipeline`. Wrap in `@Roles(GlobalRole.ADMIN)` decorator (create the decorator
      if not already present — Unit 1 already has admin-guard machinery; reuse it).

### A.7 — Reviewer dashboard endpoint

- [x] **19.** Create `src/review/reviewer-dashboard.controller.ts` (sibling of
      `ReviewController`, mounted at `/reviews` so the route is `GET /reviews/assigned`).
      Add to `ReviewModule.controllers`.
- [x] **20.** Add `getAssignedReviewerDashboard(actor)` method to `ReviewService` (or a small
      helper service if `ReviewService` becomes too crowded).
- [x] **21.** Server-side scorecard rollup query — reuse the U6
      `PortfolioService.buildProjectSummary` style or a minimal duplicate that just SUMs
      attempted/verified/awarded.

### A.8 — Project + Green Rater dashboard endpoints

- [x] **22.** Create `src/dashboards/dashboards.module.ts`,
      `src/dashboards/dashboards.service.ts`, `src/dashboards/dashboards.controller.ts`.
      Routes: `GET /dashboards/project`, `GET /dashboards/green-rater`.
- [x] **23.** Implement `computeOutstandingActions(project, latestReview, agreement,
      invoice, attempted, awarded)` as a pure helper inside the service (BR-DH2 priority
      rules).
- [x] **24.** Workbook progress aggregation queries (BR-DH3): four COUNT statements per
      project, batched via a single CTE-style query when feasible.

### A.9 — Wiring + RBAC

- [x] **25.** Update `src/app.module.ts`:
      - Import `NotificationsModule`, `AdminModule`, `DashboardsModule`.
      - Register `Notification` entity in `TypeOrmModule.forRoot.entities`.
      - Add `notification_recipient_idx` and `notification_kind_idx` to
        `RegistrationDdlBootstrapper.bootstrapNotificationIndexes()` (idempotent
        `CREATE INDEX IF NOT EXISTS`).

---

## Phase B — Frontend (Steps 26-37)

### B.1 — DTOs + ApiClient

- [x] **26.** Extend `src/app/core/api/dto.ts` with the U7 shapes per
      `frontend-components.md` (NotificationKind, NotificationDto, dashboards, pipeline).
- [x] **27.** Extend `src/app/core/api/api-client.ts` with the 8 new methods.

### B.2 — Stores

- [x] **28.** Create `src/app/features/notifications/notifications.store.ts` with
      `unreadCount`, `recent`, `page`, `nextCursor`, polling timer, methods.
- [x] **29.** Create `src/app/features/dashboards/dashboards.store.ts` (4 dashboard state
      signals + load methods).
- [x] **30.** Create `src/app/features/dashboards/admin-pipeline.store.ts` (rows, filter,
      cursor, debounce, action methods reusing existing `assignReviewer` /
      `saveQualityScore`).

### B.3 — Components

- [x] **31.** Create `src/app/shared/notifications-bell/notifications-bell.component.ts`
      (icon button + matBadge + MatMenu dropdown). Mount in `app.component`.
- [x] **32.** Create `src/app/features/notifications/notifications-page.component.ts` with
      Material list + infinite scroll (IntersectionObserver) + filter chips.
- [x] **33.** Create `src/app/features/dashboards/dashboard-redirect.component.ts` —
      `OnInit` resolves the highest-privilege view and `router.navigate`s.
- [x] **34.** Create the four dashboard pages:
      `dashboard-project-page.component.ts`, `dashboard-green-rater-page.component.ts`,
      `dashboard-reviewer-page.component.ts`, `dashboard-admin-page.component.ts`.
- [x] **35.** Create dialogs: `dashboard-admin/assign-reviewer.dialog.component.ts` and
      `dashboard-admin/edit-quality-score.dialog.component.ts`.

### B.4 — Routing + shell + edge-cases

- [x] **36.** Update `src/app/app.routes.ts` with the 6 new lazy routes from
      `frontend-components.md`. Update `app.component.ts` shell to add the "Dashboard" link
      and `<gbci-notifications-bell>` insertion point.
- [x] **37.** Empty-state behaviors: `/dashboard/project` shows a "Register your first
      project" CTA when no items; `/dashboard/admin` filter row gracefully handles unknown
      reviewer IDs (autocomplete fed from existing `users` data — for the first ship, use a
      free-text input with the user's UUID, with a follow-up to add a search endpoint).

---

## Phase C — Documentation + Validation (Steps 38-45)

- [x] **38.** Create `aidlc-docs/construction/unit-7-dashboards-notifications/code/README.md`
      listing files, endpoints, smoke results, scope deviations.
- [x] **39.** Update `usgbc-hub-residential-be/README.md` to "Units 1–7 complete" with U7
      endpoint quick reference.
- [x] **40.** Update `usgbc-hub-residential-fe/README.md` to "Units 1–7 complete" with the
      new dashboard + notifications routes.
- [x] **41.** Update `aidlc-docs/inception/application-design/unit-of-work-story-map.md`:
      mark US-7.8, US-10.1, US-10.2, US-10.3, US-10.4, US-10.5 as `[x] U7`.
- [x] **42.** Update `aidlc-state.md`: U7 row → FD ✅, NFRR `— (skipped)`,
      NFRD `— (skipped per user)`, CodeGen ✅; Feature → Unit map U7 rows → ✅; Current
      Stage line.
- [x] **43.** Run `npm run build` in both BE + FE; capture clean output.
- [x] **44.** Run `get_diagnostics` on every new/modified TypeScript file.
- [x] **45.** End-to-end smoke against the running stack:
      - Login as Admin; visit `/dashboard` → redirect to `/dashboard/admin`. Pipeline loads.
        Filter by status=REGISTERED; row count drops monotonically. Open a row's "Assign
        reviewer" dialog; assign a reviewer; refresh → `assignedReviewer` populated.
      - Login as Reviewer (the just-assigned user); visit `/dashboard` → redirect to
        `/dashboard/reviewer`. Project appears in the appropriate bucket.
      - As Project Team on the demo project: visit `/dashboard/project`; outstanding actions
        chip list shows expected entries.
      - Trigger a U5 review submit from the project. Login as Project Team and verify the
        bell badge increments to 1; open dropdown → see `REVIEW_SUBMITTED` row;
        click row → routed to the project page; `unreadCount` decrements.
      - Verify the U1 mock console-log of the same event is also present (forward-compat).

---

## Story coverage table

| Story | Steps |
|---|---|
| US-7.8 Workflow notifications | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25, 26, 27, 28, 31, 32, 36 |
| US-10.1 Project dashboard | 22, 23, 26, 27, 29, 33, 34, 36 |
| US-10.2 Green Rater dashboard | 22, 23, 24, 26, 27, 29, 33, 34, 36 |
| US-10.3 Reviewer dashboard | 19, 20, 21, 26, 27, 29, 33, 34, 36 |
| US-10.4 Admin pipeline + assign | 15, 16, 17, 18, 25, 26, 27, 30, 33, 34, 35, 36 |
| US-10.5 Admin revise quality score | 30, 35 (FE-only; BE was already done in U5) |
| Cross-cutting RBAC | 18, 25, 36 |
| Cross-cutting audit | 11, 12, 13, 14 (existing service paths) |
| PBT-01 properties | 4 (FL-15), 6 (FL-16 subject), 15 (FL-17) |
| Documentation | 38-42 |
| Validation | 43, 44, 45 |

---

## PBT compliance for this unit

- **PBT-01** Property identification — COMPLIANT. Three properties documented with pure /
  test-friendly subjects implemented:
  - **FL-15** Recipient fan-out invariant (pure).
  - **FL-16** Unread-count invariant.
  - **FL-17** Pipeline-filter idempotence (pure).
- **PBT-09** Framework selection — COMPLIANT (fast-check carried over).
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per the U1 precedent).

No blocking PBT findings. The codebase remains test-friendly for when tests are turned back on.
