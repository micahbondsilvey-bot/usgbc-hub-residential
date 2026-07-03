# Code Generation Plan — Unit 5: Review Workflow & State-Locking

**Source of truth** for U5 Code Generation. NFRR + NFRD stages SKIPPED per user direction
(carried forward from U3/U4); cross-cutting NFRs inherit from U1+U2+U4. Tests skipped per
documented U1 PBT deviation.

---

## Unit Context

- **Workspace root**: `/Users/hbayyapu/usgbc-hub-residential`
- **Backend dir**: `usgbc-hub-residential-be/`
- **Frontend dir**: `usgbc-hub-residential-fe/`
- **Doc summary**: `aidlc-docs/construction/unit-5-review-workflow/code/`

### Stories
- US-7.1 Submit for review with phase selection (Prelim before Final; Final-skippable)
- US-7.3 Reviewer credit-by-credit decisions & award points (`Awarded ≤ Verified`)
- US-7.4 Auto-generate & return review report (two-step return)
- US-7.6 Accept certification or continue to next phase
- US-7.7 Reviewer enters submittal quality score (authoritative on entry; revisable)
- US-11.2 Submission state-locking (replaces U2 stub)

### Dependencies
- U1 (auth, RBAC, audit, notifications, hooks registry).
- U2 (scorecard with `awardedPoints` column; column-writers map extension).
- U3 (Project entity + status state machine; sequence-bootstrap pattern).
- U4 (workbook REVIEWER notes column; state-lock call sites in scorecard/workbook/projects).

### Database entities owned by this unit
- `Review`, `SubmittalQualityScore`.
- `Project.achievedCertificationLevel` (new column).
- One new Postgres sequence: `reviews_display_seq` (start 100001).

### NPM dependencies added
- Backend: none.
- Frontend: `marked` (Markdown renderer for the report viewer) — small dep, widely used.

---

## Generation Steps

### Backend — Sequence + state-machine extensions

- [x] **Step 1** Modify `src/projects/registration-ddl.bootstrapper.ts` — add the
  `reviews_display_seq` (`CREATE SEQUENCE IF NOT EXISTS reviews_display_seq START 100001 NO CYCLE`).
- [x] **Step 2** Modify `src/projects/state-machine/project-status.machine.ts` — extend the
  `ALLOWED` map per BR-Z2:
  - Add `UNDER_REVIEW → REGISTERED` (return path).
  - Add `REGISTERED → CERTIFIED` (accept-from-prelim-passed path).
- [x] **Step 3** Add `Project.achievedCertificationLevel` column (BR-AC1) to
  `src/projects/project.entity.ts` (`varchar(64)` nullable). Mirrors `targetCertificationLevel`.

### Backend — Review domain

- [x] **Step 4** Create `src/review/enums/review.enums.ts` exporting `ReviewPhase`,
  `ReviewStatus`, `ReviewOutcome`.
- [x] **Step 5** Create `src/review/state-machine/review-status.machine.ts` — pure
  `assertTransition(from: ReviewStatus, to: ReviewStatus)` per BR-RW1. PBT-01 target FL-10.
- [x] **Step 6** Create `src/review/review.entity.ts` (all columns from `domain-entities.md`
  Review; UNIQUE on `(projectId, phase)` and `displayId`).
- [x] **Step 7** Create `src/review/submittal-quality-score.entity.ts` (UNIQUE on
  `(projectId, reviewId)`; score 0..5 enforced at app layer).
- [x] **Step 8** Create `src/review/review-number.generator.ts` (mirrors U3
  `ProjectNumberGenerator`; `REV-${nextval}` from `reviews_display_seq`; idempotent on
  already-set displayId).
- [x] **Step 9** Create DTOs under `src/review/dto/`:
  - `review.dto.ts` (full Review payload)
  - `submit-for-review.dto.ts`
  - `confirm-review.dto.ts`
  - `award-all-verified-response.dto.ts`
  - `submittal-quality-score.dto.ts` + `set-quality-score.dto.ts`
  - `assign-reviewer.dto.ts`

### Backend — Review report generator (pure)

- [x] **Step 10** Create `src/review/report/review-report.generator.ts` —
  `generateMarkdown(input: ReportInput): string` pure function (no Nest imports). PBT-01
  target candidate.

### Backend — State-lock real implementation (BR-Z1)

- [x] **Step 11** Modify `src/scorecard/state-lock.service.ts` — replace the U2 stub with the
  real implementation per BL-10. Inject `Repository<Project>`. Update method signature to
  `assertWritable(projectId: string, actor?: { userId: string; globalRole: GlobalRole }):
  Promise<void>` (now async because it queries the DB).
- [x] **Step 12** Modify the `ScorecardModule` providers list to register the new dependency
  (`@InjectRepository(Project)`); register `Project` in `forFeature` of `ScorecardModule`.
- [x] **Step 13** Update existing call sites to await `assertWritable` and pass the actor:
  - `src/scorecard/scorecard.service.ts` — `setPoints`, `toggleAttempted` (in `setPoints` use
    actor; preserve order with the existing transaction).
  - `src/projects/projects.service.ts` — `patch`, `transitionStatus`, `withdraw`.
  - `src/workbook/workbook.service.ts` — `setFieldValue`, `saveNote`.
  - `src/workbook/submittals.service.ts` — `upload`, `delete`.
  - `src/projects/registration.orchestrator.ts` — uses `transitionStatus` already; double-check
    flows pass the actor.
  - `src/projects/agreement.service.ts` — `record` flow.
  Note: many call sites already use a `{ userId, globalRole }` actor object; the actor passes
  through naturally. Where the helper signature changes from sync `void` to async
  `Promise<void>`, await the call.

### Backend — Review writers extension to scorecard

- [x] **Step 14** Modify `src/scorecard/scorecard.service.ts` — extend the `COLUMN_WRITERS`
  map so that `awardedPoints: [ProjectRole.REVIEWER]` (BR-RD2). Admin already passes via the
  global-role bypass.

### Backend — Orchestrators + service

- [x] **Step 15** Create `src/review/review.service.ts` (read paths; CRUD on
  `Review` + `SubmittalQualityScore`; helpers used by orchestrators).
- [x] **Step 16** Create `src/review/submission.orchestrator.ts` implementing BL-1 (submit /
  re-submit-after-return) inside a single TypeORM transaction. Auto-fires
  `NotificationGateway.send({ kind: 'submission-confirmed' })` post-commit.
- [x] **Step 17** Create `src/review/review.orchestrator.ts` implementing
  BL-3 (confirm with report-generation + outcome derivation) and BL-4 (return with state-lock
  release + notification post-commit).
- [x] **Step 18** Create `src/review/award-decisions.service.ts` implementing BL-2
  (`setAwarded` per credit + `awardAllVerified` bulk; FL-9 hard invariant + FL-11 idempotence).
- [x] **Step 19** Create `src/review/accept-certification.flow.ts` implementing BL-5 (accept)
  and BL-6 (continue-to-next-phase).
- [x] **Step 20** Create `src/review/quality-score.service.ts` implementing BL-7.
- [x] **Step 21** Create `src/review/reviewer-assignment.service.ts` implementing BL-8.

### Backend — Controllers

- [x] **Step 22** Create `src/review/review.controller.ts` exposing
  `GET /projects/:projectId/reviews`,
  `GET /projects/:projectId/reviews/:reviewId`,
  `GET /projects/:projectId/reviews/:reviewId/report` (text/markdown response),
  `POST /projects/:projectId/reviews` (submit),
  `POST /projects/:projectId/reviews/:reviewId/award-all-verified`,
  `POST /projects/:projectId/reviews/:reviewId/confirm`,
  `POST /projects/:projectId/reviews/:reviewId/return`,
  `POST /projects/:projectId/accept`,
  `POST /projects/:projectId/continue-to-next-phase`,
  `PUT /projects/:projectId/reviews/:reviewId/quality-score`,
  `GET /projects/:projectId/quality-scores`,
  `POST /projects/:projectId/reviewers` (admin shortcut).
  Protected by `ProjectRolesGuard` with `@ProjectRoles('*')` on per-project routes.

### Backend — Module wiring

- [x] **Step 23** Create `src/review/review.module.ts` registering the entities + providers +
  controllers; imports `AuditModule`, `CatalogModule`, `MembershipModule`, `UsersModule`,
  `ScorecardModule` (to use `ScorecardService` for award writes), `ProjectsModule` (to use
  `ProjectsService` for status transitions). Cross-module ProjectsModule import: ensure no
  circular dep (ProjectsModule does not import ReviewModule).
- [x] **Step 24** Modify `src/app.module.ts` — register the new entities (`Review`,
  `SubmittalQualityScore`) and `ReviewModule`.

### Backend — Demo seed bridge

- [x] **Step 25** Create `src/review/review.demo-seeder.ts` — `OnModuleInit` after the
  workbook demo seeder. Optional: idempotently inserts a single `Review(projectId =
  DEMO_PROJECT_ID, phase = PRELIMINARY, status = SUBMITTED)` so the demo project has a
  visible in-flight review for the FE to render. Skipped if any review row already exists for
  the demo project.

### Backend — Tests — SKIPPED PER DOCUMENTED DEVIATION
- [ ] ~~Step 26~~ **Skipped** — PBT for `assertTransition` (FL-10).
- [ ] ~~Step 27~~ **Skipped** — PBT for award invariant (FL-9).
- [ ] ~~Step 28~~ **Skipped** — PBT for awardAllVerified idempotence (FL-11).
- [ ] ~~Step 29~~ **Skipped** — example tests for orchestrator paths.

### Frontend — DTOs & ApiClient extension

- [x] **Step 30** Extend `src/app/core/api/dto.ts` with all U5 shapes
  (`ReviewDto`, `SubmitForReviewDto`, `ConfirmReviewDto`, `AwardAllVerifiedResponseDto`,
  `SubmittalQualityScoreDto`, `AssignReviewerDto`, plus `ReviewPhase | ReviewStatus |
  ReviewOutcome` types).
- [x] **Step 31** Extend `src/app/core/api/api-client.ts` with U5 endpoints (~12 new methods).

### Frontend — Review feature

- [x] **Step 32** Add `marked` to `usgbc-hub-residential-fe/package.json` deps.
- [x] **Step 33** Create `features/review/review.store.ts` (Signals; loads reviews + quality
  scores; orchestrates submit/confirm/return/accept/score actions).
- [x] **Step 34** Create `features/review/review-page.component.ts` — top-level variant-
  routing page (renders reviewer panel OR outcome panel based on review status + actor role).
- [x] **Step 35** Create `features/review/reviewer-panel.component.ts` — Material table per
  scorecard credit with inline awarded input, "Award all verified" + "Confirm" + "Return"
  actions. Inlines the row component.
- [x] **Step 36** Create `features/review/outcome-panel.component.ts` — read-only outcome,
  per-credit awarded vs verified table, accept / continue actions.
- [x] **Step 37** Create `features/review/submit-for-review.dialog.component.ts` — Mat dialog
  with phase picker + fee confirmation note + "I confirm the workbook is ready" checkbox.
- [x] **Step 38** Create `features/review/report-viewer.component.ts` — uses `marked` to
  render `review.reportMarkdown` (sanitized by Angular's default DomSanitizer + `[innerHTML]`).
- [x] **Step 39** Create `features/review/quality-score-card.component.ts` — Reviewer/Admin
  editable; other roles read-only.

### Frontend — App shell wiring

- [x] **Step 40** Update `src/app/app.routes.ts` adding `/projects/:projectId/review`
  (lazy-loaded). Place after `/projects/:projectId/workbook`.
- [x] **Step 41** Update `src/app/features/projects/project-detail-page.component.ts` adding a
  "Review" button alongside "Scorecard" / "Workbook".

### Frontend — Tests — SKIPPED
- [ ] ~~Step 42~~ **Skipped** — FE PBT mirror of state-machine + example component tests.

### Documentation

- [x] **Step 43** Create `aidlc-docs/construction/unit-5-review-workflow/code/README.md`.
- [x] **Step 44** Update `usgbc-hub-residential-be/README.md` to "Units 1–5 complete" with U5
  endpoint quick reference and updated project layout (added `review/`).
- [x] **Step 45** Update `usgbc-hub-residential-fe/README.md` to "Units 1–5 complete" with the
  new review route.

### Validation

- [x] **Step 46** Diagnostics clean across all created/modified files.
- [x] **Step 47** No duplicate file artifacts (`*_modified.ts`, `*_new.ts`).
- [x] **Step 48** Mark all 6 U5 stories `[x]` in the story map.
- [x] **Step 49** Smoke test: backend boots, `reviews_display_seq` created, demo project has
  an optional in-flight review row, submit endpoint creates `REV-100001`, state-lock blocks
  PT/GR writes during UNDER_REVIEW, Reviewer can set awarded points (and is rejected for
  out-of-range), award-all-verified bulk works idempotently, confirm generates the markdown
  report, return releases the state-lock and flips status back to REGISTERED, accept
  transitions to CERTIFIED, quality score persists and is revisable, FE workbook + scorecard
  pages still work end-to-end.

---

## Story Coverage

| Story | Steps |
|---|---|
| US-7.1 (submit + phase) | 4–9, 16, 22, 30, 31, 33, 34, 37, 40, 41 |
| US-7.3 (decisions + award-all) | 14, 18, 22, 30, 31, 33, 35 |
| US-7.4 (report + return) | 5, 6, 10, 17, 22, 30, 31, 38 |
| US-7.6 (accept / continue) | 2, 3, 19, 22, 30, 31, 36 |
| US-7.7 (quality score) | 7, 9, 20, 22, 30, 31, 39 |
| US-11.2 (state-lock real) | 11, 12, 13, 14 |

## Total
**49 numbered steps** (4 marked skipped consistent with the U1 PBT deviation).

## PBT Compliance for this stage
- **PBT-01**: COMPLIANT — three properties documented (FL-9 award range invariant, FL-10
  state-machine invariant, FL-11 award-all-verified idempotence). Pure subjects implemented
  test-friendly (`review-status.machine.ts`, `review-report.generator.ts`, the state-machine
  helpers).
- **PBT-09**: COMPLIANT — fast-check carried over.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DEVIATION) — tests skipped per Unit 1 precedent.
