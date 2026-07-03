# Unit 5 — Review Workflow & State-Locking — Code summary

This is the implementation summary for Unit 5. The plan lives at
`aidlc-docs/construction/plans/unit-5-review-workflow-code-generation-plan.md`.
NFR Requirements + NFR Design were skipped per user direction (carried
forward from U3/U4); cross-cutting NFR concerns inherit from U1+U2+U4.

---

## Backend file inventory (`usgbc-hub-residential-be/`)

### Sequence + status-machine extensions
- `src/projects/registration-ddl.bootstrapper.ts` — added
  `reviews_display_seq` (start `100001`, no cycle) alongside the existing
  projects + invoices sequences.
- `src/projects/state-machine/project-status.machine.ts` — extended `ALLOWED`
  map per BR-Z2: added `UNDER_REVIEW → REGISTERED` (return path) and
  `REGISTERED → CERTIFIED` (accept-from-prelim-passed path).
- `src/projects/project.entity.ts` — added `achievedCertificationLevel` column
  (BR-AC1, distinct from `targetCertificationLevel`).

### Review domain
- `src/review/enums/review.enums.ts` — `ReviewPhase`, `ReviewStatus`,
  `ReviewOutcome`.
- `src/review/state-machine/review-status.machine.ts` — pure
  `assertReviewTransition` (PBT-01 target FL-10).
- `src/review/review.entity.ts` — full lifecycle row, UNIQUE on
  `(projectId, phase)` + `displayId`.
- `src/review/submittal-quality-score.entity.ts` — UNIQUE on
  `(projectId, reviewId)`, score 0..5 enforced at app layer.
- `src/review/review-number.generator.ts` — sequential `REV-${nextval}` with
  idempotency.
- DTOs under `src/review/dto/{review, submit-for-review, confirm-review,
  award-all-verified-response, submittal-quality-score, set-quality-score,
  assign-reviewer}.dto.ts`.

### Pure markdown report generator
- `src/review/report/review-report.generator.ts` — pure `generateMarkdown`
  function (no Nest imports). Same input ⇒ same output.

### State-lock real implementation
- `src/scorecard/state-lock.service.ts` — REPLACED the U2 stub. Inject
  `Repository<Project>` + `MembershipService`. Async `assertWritable(projectId,
  actor?)`:
  - System writes (no actor) → no-op.
  - Admin → bypasses.
  - `UNDER_REVIEW` + Reviewer membership → passes (Reviewers are the intended
    writer during review).
  - Otherwise during `UNDER_REVIEW` → throws `ConflictException`.
- `src/scorecard/scorecard.module.ts` — registered `Project` repo for the lock
  service's queries.
- All call sites (`ScorecardService`, `WorkbookService`, `SubmittalsService`,
  `ProjectsService`) updated to `await stateLock.assertWritable(projectId, actor)`
  and pass the actor.

### Award decisions integration with U2 scorecard
- `src/scorecard/scorecard.service.ts` — `COLUMN_WRITERS.awardedPoints =
  [Reviewer]` (BR-RD2). Hard FL-9 invariant added to `setPoints`: `0 ≤
  awardedPoints ≤ verifiedPoints`. Reviewers writing through the existing
  scorecard endpoint are gated by both the writer rules and the FL-9 invariant;
  the U5 review endpoints additionally bump the in-flight review's status.

### Orchestrators + services
- `src/review/review.service.ts` — read paths + DTO mapping +
  authorization helpers.
- `src/review/submission.orchestrator.ts` — BL-1 submit (with re-submit-
  after-return path BR-RW8).
- `src/review/award-decisions.service.ts` — BL-2 setAwarded (with FL-9 +
  in-flight review status promotion) + awardAllVerified (FL-11 idempotent).
- `src/review/review.orchestrator.ts` — BL-3 confirm (auto-generates
  Markdown report; computes outcome + certification level) + BL-4 return
  (lifts state-lock; fires mock notification post-commit).
- `src/review/accept-certification.flow.ts` — BL-5 accept (project →
  CERTIFIED) + BL-6 continue-to-next-phase (audit-only).
- `src/review/quality-score.service.ts` — BL-7 upsert + list with
  authoritative-on-entry semantics + audit-tracked revisions.
- `src/review/reviewer-assignment.service.ts` — BL-8 admin shortcut
  (idempotent).

### Controller + module
- `src/review/review.controller.ts` — 11 endpoints under
  `/projects/:projectId/...`.
- `src/review/review.module.ts` — wires entities (Review,
  SubmittalQualityScore, ScorecardEntry, VerificationNote, Project) +
  imports the cross-module modules (Audit, Catalog, Membership, Users,
  Scorecard, Projects).
- `src/app.module.ts` — registered the 2 new entities and ReviewModule.

## Frontend file inventory (`usgbc-hub-residential-fe/`)

- `src/app/core/api/dto.ts` — extended with U5 shapes.
- `src/app/core/api/api-client.ts` — extended with 11 new methods.
- `src/app/features/review/review.store.ts` — Signals store with submit /
  award-all / confirm / return / accept / continue / quality-score actions.
- `src/app/features/review/review-page.component.ts` — variant-routing
  page. Renders no-review CTA, Reviewer panel (Material table with inline
  awarded inputs + "Award all verified" + "Confirm" + "Return" buttons),
  CONFIRMED card with report viewer, RETURNED card with Accept / Continue
  actions.
- `src/app/features/review/submit-for-review.dialog.component.ts` — phase
  picker + ready-to-submit checkbox + fee placeholder note.
- `src/app/features/review/report-viewer.component.ts` — sanitized
  `marked` Markdown renderer for the report.
- `src/app/features/review/quality-score-card.component.ts` — Reviewer/Admin
  editable score + notes; read-only for other roles.
- `src/app/app.routes.ts` — added `/projects/:projectId/review` lazy route.
- `src/app/features/projects/project-detail-page.component.ts` — added
  "Review" button alongside "Scorecard" / "Workbook".
- `package.json` — added `marked` (Markdown renderer for the report viewer).

## Backend endpoints (new in U5)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/projects/:projectId/reviews` | member or Admin | List reviews (latest first) |
| GET | `/api/v1/projects/:projectId/reviews/:reviewId` | member or Admin | Single review with report markdown |
| GET | `/api/v1/projects/:projectId/reviews/:reviewId/report` | member or Admin | Plain `text/markdown` body |
| POST | `/api/v1/projects/:projectId/reviews` | PT/GR/Admin | Submit-for-review with phase |
| POST | `/api/v1/projects/:projectId/reviews/:reviewId/award-all-verified` | Reviewer/Admin | Bulk + idempotent |
| POST | `/api/v1/projects/:projectId/reviews/:reviewId/confirm` | Reviewer/Admin | Auto-generates report; transitions to CONFIRMED |
| POST | `/api/v1/projects/:projectId/reviews/:reviewId/return` | Reviewer/Admin | Releases to Green Rater + lifts state-lock |
| POST | `/api/v1/projects/:projectId/accept` | PT/GR/Admin | Project → CERTIFIED |
| POST | `/api/v1/projects/:projectId/continue-to-next-phase` | PT/GR/Admin | Audit-only intent |
| PUT | `/api/v1/projects/:projectId/reviews/:reviewId/quality-score` | Reviewer/Admin | Authoritative score (revisable) |
| GET | `/api/v1/projects/:projectId/quality-scores` | member or Admin | Latest per review |
| POST | `/api/v1/projects/:projectId/reviewers` | Admin only | Assignment shortcut |

## Demo data after seed

The demo project starts in `REGISTERED` status. To exercise the workflow:
1. Sign in as `rater@residential.test` and submit for review (PRELIMINARY).
2. Sign in as `reviewer@residential.test` and click "Award all verified" + "Confirm".
3. Click "Return" — the project's status flips back to `REGISTERED`.
4. Sign in as `team@residential.test` and click "Accept certification" — the
   project transitions to `CERTIFIED`.

The U2 demo seeder pre-populates Silver-band awarded values, so a single
`Award all verified` click confirms with outcome `PASSED` and level
`Certified`.

## Story coverage

| Story | Status | Where |
|---|---|---|
| US-7.1 (submit + phase) | ✅ | `SubmissionOrchestrator` + `SubmitForReviewDialog` |
| US-7.3 (decisions + award-all) | ✅ | `AwardDecisionsService` + reviewer panel inline awarded inputs + "Award all verified" |
| US-7.4 (report + return) | ✅ | `ReviewOrchestrator.confirm/return` + pure `review-report.generator` + `ReportViewer` |
| US-7.6 (accept / continue) | ✅ | `AcceptCertificationFlow` + outcome panel actions |
| US-7.7 (quality score) | ✅ | `QualityScoreService` + `QualityScoreCard` with audit-tracked revisions |
| US-11.2 (state-lock real) | ✅ | `StateLockService` real impl + project status state-machine extensions |

## PBT compliance for U5

- **PBT-01**: COMPLIANT — three properties documented in
  `business-logic-model.md` FL-9..FL-11 (award range invariant, state-machine
  invariant, award-all-verified idempotence). Pure subjects implemented:
  - `src/review/state-machine/review-status.machine.ts` (FL-10).
  - `src/review/report/review-report.generator.ts` (re-runnable, deterministic).
  - FL-9 enforced in `ScorecardService.setPoints` AND `AwardDecisionsService.setAwarded`.
  - FL-11 idempotence verified by smoke test (re-running awardAllVerified returns `updatedCount: 0`).
- **PBT-09**: COMPLIANT — fast-check carried over.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped
  per Unit 1 precedent.

## Run instructions

The full local stack is unchanged. Restart the BE to pick up the new sequence
+ entities + ReviewModule. Visit `http://localhost:4200/projects/<projectId>/review`
after signing in.

End-to-end smoke (verified live): submit → state-lock blocks PT/GR scorecard
writes → reviewer rejects out-of-range awards (400) → award-all-verified bulk
(idempotent) → confirm (auto-generates 2.9 KB Markdown report; outcome PASSED;
level Certified) → quality score persists and is admin-revisable → return
(state-lock lifts) → PT scorecard write succeeds (200) → accept (project →
CERTIFIED with `achievedCertificationLevel = Certified`).
