# Unit 5 — Review Workflow & State-Locking — Batched Design Plan

**Cadence note (carried forward from U3/U4).** Per user direction:
- **NFR Requirements stage SKIPPED for U5.** No new infra (no new provider seam this build —
  notifications use the U1 mock; reports persist as Markdown text in the DB; PDFs deferred).
- **NFR Design stage SKIPPED for U5.** All cross-cutting NFR concerns (Angular 20.2 / Node 20.19,
  NestJS, PG, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA, throttler, audit, RBAC,
  request-context, mock notifications, hooks registry from U4) inherit unchanged.
- **What U5 will produce:** Functional Design (4 artifacts) + Code Generation Plan in one
  approval-gated wave, then code execution. PBT-01 properties identified for the state machine,
  the award-all-verified bulk update, and the report generator.

---

## Stories in scope (per `unit-of-work.md`)

| Story | Title | Notes |
|---|---|---|
| US-7.1 | Submit for review with phase selection | Prelim before Final; Final skippable when prelim awarded everything required |
| US-7.3 | Reviewer credit-by-credit decisions & award points | "Award all verified" one-click; Awarded ≤ Verified |
| US-7.4 | Auto-generate & return review report | Reviewer confirms first, then released to GR |
| US-7.6 | Accept certification or continue to next phase | Project Team / Green Rater action |
| US-7.7 | Reviewer enters submittal quality score | Authoritative on entry; revisable by Reviewer/Admin |
| US-11.2 | Submission state-locking | Replaces the U2 `StateLockService` stub; PBT-target stateful invariant |

Out-of-scope (later units):
- US-7.2 batch submit → U6 Portfolio.
- US-7.5 MS Bookings scheduling → U9 Mobile/PWA.
- US-7.8 workflow notifications framework → U7 Dashboards & Notifications (U5 fires the existing
  U1 `NotificationGateway.send(...)` for the immediate review-workflow events; the framework
  ships in U7).
- US-10.5 admin score revise → U7.

---

## Architectural decisions inherited (NOT re-asked)

| From | Decision |
|---|---|
| U1-Q1 | Hybrid RBAC: global Admin + per-project roles. `ProjectRolesGuard` protects all `/projects/:id/review/*` routes. |
| U1-Q2 | `AuditStampInterceptor` for HTTP writes; explicit `AuditService.record` on review state transitions. |
| U2-Q4 | Last-write-wins; `version: integer` on every persisted row. |
| U3 | `Project.status` enum already includes `UNDER_REVIEW | CERTIFIED | DENIED`; the status state machine in `project-status.machine.ts` already encodes the allowed transitions. U5 just **wires the writers**. |
| U4 | `WorkbookAttemptHookRegistry` proves the cross-module hook pattern; U5 reuses the same shape for the `ReviewSubmittedHookRegistry` if needed (probably not — U5's writers know about the workbook directly). |

---

## Design questions (10)

> All FD-level. Recommended option in **bold**. An "all-A" reply produces a coherent design.

### Q1 — Review entity grain (US-7.1, US-7.4)
- A. **One `Review` row per `(project, phase)`. Re-submitting the same phase after a
  return-with-issues mutates the existing row's `status` field (`OPEN → SUBMITTED → DECIDED →
  CONFIRMED → RETURNED`). Lifecycle audit is captured in `audit_log`. A second `Review` row for
  a NEW phase (Final following Prelim) is created on demand. Display ID `REV-${nextval}` from
  a new Postgres sequence `reviews_display_seq` (start `100001`, mirrors U3's pattern).**
- B. New `Review` row per submission/return cycle.

### Q2 — Review phase enum & ordering (US-7.1)
- A. **`ReviewPhase = PRELIMINARY | FINAL | SUPPLEMENTAL`. Submission ordering rule:
  - `PRELIMINARY` may be submitted whenever `Project.status = REGISTERED`.
  - `FINAL` may be submitted only when there exists a `Review(phase=PRELIMINARY,
    status=CONFIRMED|RETURNED)` whose `outcome` is one of `PASSED | PASSED_WITH_ISSUES`.
  - **Final-skippable**: when the prelim review's `outcome = PASSED` (everything attempted was
    awarded), the project bypasses Final and the user can `accept` directly from Prelim.
  - `SUPPLEMENTAL` allowed after `FINAL` is RETURNED with outstanding items, similar precedence.**
- B. Just `PRELIMINARY | FINAL`; defer supplemental.

### Q3 — Credit decisions storage (US-7.3)
- A. **Reviewer writes directly to the existing `ScorecardEntry.awardedPoints` column (already
  shipped in U2 with `[]` writers — only Admin could set it before U5). U5 adds Reviewer to the
  writers list for the `awardedPoints` column. NO new `CreditDecision` entity. Per-credit
  reviewer comments live in the existing U4 `VerificationNote.REVIEWER` column. The "outcome"
  per credit is implicit: `awardedPoints == verifiedPoints` ⇒ awarded; `< verifiedPoints` ⇒
  partial; `0` ⇒ denied. Decisions must satisfy `0 ≤ awardedPoints ≤ verifiedPoints` (PBT-01
  target FL-9 hard invariant — unlike U2's override-friendly attempt/verified columns, awarded
  is strict because it determines the certification level the customer is paying for).**
- B. New `CreditDecision` entity carrying `decision`, `awardedPoints`, `comment`.

### Q4 — Award-all-verified action (US-7.3)
- A. **Bulk endpoint `POST /projects/:projectId/reviews/:reviewId/award-all-verified` writes
  `awardedPoints = verifiedPoints` for every attempted credit on the project in a single
  transaction. Idempotent: re-running on already-awarded entries no-ops. Returns the affected
  count + the recomputed scorecard summary. Reviewer + Admin only.**
- B. Per-credit only.

### Q5 — Review report generation (US-7.4)
- A. **`ReviewReportService.generateMarkdown(reviewId)` is a pure function (input: scorecard
  entries + credit definitions + reviewer notes; output: Markdown string). Persisted on
  `Review.reportMarkdown TEXT`, `reportGeneratedAt`. Re-runnable; each run overwrites and bumps
  `version` (audit-recorded). PDF rendering deferred. The report contains: project header,
  per-category awarded/verified table, per-credit notes from the REVIEWER column, summary
  certification level if PASSED.**
- B. PDF via puppeteer / docx via docx-templates.

### Q6 — Two-step return flow (US-7.4 / FR-7.6)
- A. **Two distinct endpoints:
  - `POST /projects/:projectId/reviews/:reviewId/confirm` — internal review confirmation. Sets
    `Review.status = CONFIRMED`. Only the Reviewer who owns the review can call this (or Admin).
  - `POST /projects/:projectId/reviews/:reviewId/return` — releases to the Green Rater. Allowed
    only when `Review.status = CONFIRMED`. Sets `Review.status = RETURNED`, `returnedAt = NOW()`,
    fires a mock `NotificationGateway.send({ kind: 'review-returned', ... })` to project members.
    Lifts the state-lock (BR-Z transitions back to `REGISTERED`).
  Forward-compat: a future "Reviewer schedules a call" action between confirm and return is the
  same Reviewer-only path; U9 will add it.**
- B. Single "return" endpoint that transitions both internal-confirm and external-release.

### Q7 — Accept-or-continue flow (US-7.6)
- A. **`POST /projects/:projectId/accept` — Project Team / Green Rater. Allowed when there
  exists a RETURNED Review for the project AND the review's `outcome ∈ { PASSED, PASSED_WITH_
  ISSUES }`. Transitions `Project.status = CERTIFIED`, sets `Project.certificationLevel`
  (computed from `awardedPoints` against `RatingSystem.certificationLevels`).
  `POST /projects/:projectId/continue-to-next-phase` — Project Team / Green Rater. Allowed
  when there exists a RETURNED Review with outstanding issues. Sets the project status back to
  `REGISTERED` so the team can edit + resubmit (the prior `Review` row stays with its history).**
- B. Single endpoint with a `decision` body field.

### Q8 — Reviewer assignment (US-11.2 reviewer access path)
- A. **Reviewer assignment is exactly the existing `ProjectMembership` row with `projectRole =
  REVIEWER` (U1 already handles assignment by Admin via the membership / invitation flow). U5
  adds a tiny convenience endpoint `POST /projects/:projectId/reviewers` (Admin-only) that
  creates the membership directly without an invitation roundtrip — an admin shortcut for
  bench-assignment. The dashboards in U7 will use this. The state-lock + per-route guards key
  on the membership table as today; no new "assignment" table.**
- B. Separate `ReviewerAssignment` entity.

### Q9 — Submittal quality score (US-7.7)
- A. **New `SubmittalQualityScore` entity, one row per `(projectId, reviewId)`. Fields:
  `score INTEGER 0..5`, `notes TEXT`, `enteredByUserId`, `enteredAt`, `version`. Set
  authoritatively by the Reviewer at confirm-time (BR-QS1). Revisable by Reviewer or Admin
  (US-10.5 lands the admin UI in U7 — U5 just exposes the PUT endpoint to both roles). Audit
  on every change. Read paths: GR dashboard sees latest per project; Admin sees per project +
  per-Green-Rater rollups (rollup logic deferred to U7).**
- B. Single column on `Review` (no separate entity).

### Q10 — State-lock implementation (US-11.2)
- A. **Replace the U2 `StateLockService` stub with a real implementation. Logic:
  - `assertWritable(projectId, actor)`:
    - Admin always passes.
    - Project status `UNDER_REVIEW` blocks Project Team + Green Rater writes (throws
      `ConflictException`).
    - Other statuses pass.
  - The U2/U4 call sites (`ScorecardService`, `WorkbookService`, `ProjectsService.patch`,
    `SubmittalsService`) ALREADY call `assertWritable` — just the implementation changes. No
    new wiring required. The existing call sites pass `projectId` only; we extend the signature
    to optionally take `actor` for the admin-bypass path. Backward compat: when no actor is
    supplied (system-driven writes), the lock no-ops.
  - On `submit-for-review`, project flips to `UNDER_REVIEW` (audit-tracked).
  - On `return-review` (BR-RW6), project flips back to `REGISTERED` (audit-tracked) — the GR
    can edit + resubmit if the review surfaced issues.
  - On `accept`, project flips to `CERTIFIED` (terminal except WITHDRAWN).
  - PBT-01 target FL-10: stateful invariant — for any sequence of `(submit, decide, confirm,
    return, accept-or-continue)` operations, the project never enters an illegal state.**
- B. Application-wide middleware that intercepts every write.

---

## Approval gate

After your answers, I will (one wave):
1. Generate `aidlc-docs/construction/unit-5-review-workflow/functional-design/{domain-entities,
   business-rules, business-logic-model, frontend-components}.md`.
2. Generate `aidlc-docs/construction/plans/unit-5-review-workflow-code-generation-plan.md`.
3. Mark this batched plan checklist complete and update `aidlc-state.md`.

> Tests remain skipped per the U1 PBT deviation. PBT-01 properties:
> - **FL-9** Award invariant: `0 ≤ awardedPoints ≤ verifiedPoints` for every credit decision.
> - **FL-10** State-machine invariant: no command sequence leaves a project in an illegal status.
> - **FL-11** Award-all-verified idempotence: applying the bulk action twice equals applying it
>   once (already-awarded rows no-op).

---

## Part 2 generation checklist

- [ ] FD: `domain-entities.md` — Review, ReviewOutcome, ReviewStatus, ReviewPhase enum, SubmittalQualityScore, sequence `reviews_display_seq`.
- [ ] FD: `business-rules.md` — BR-RW (review workflow), BR-RD (decisions), BR-RP (report), BR-AC (accept/continue), BR-QS (quality score), BR-Z (state-lock real implementation), BR-AS (reviewer assignment shortcut).
- [ ] FD: `business-logic-model.md` — submit/decide/confirm/return/accept orchestrators, report generation, state-lock interplay with U2/U4 writers, FL-9..FL-11 properties.
- [ ] FD: `frontend-components.md` — review page (reviewer view: per-credit awarded inputs, "award all verified", confirm + return + report preview); accept-or-continue page (project team/GR view); review report rendered as Markdown; submittal quality score card; dto.ts/api-client.ts extensions.
- [ ] Plan: `unit-5-review-workflow-code-generation-plan.md` — numbered backend (entity + sequence + state-lock real impl + orchestrators + report generator + controllers) + frontend (reviewer + accept pages + report viewer) + docs + validation steps; story coverage table.
- [ ] State: mark U5 FD ✅ in `aidlc-state.md`; NFRR/NFRD rows show `— (skipped per user)`.
- [ ] Audit: log this batched plan + the user's answers.
