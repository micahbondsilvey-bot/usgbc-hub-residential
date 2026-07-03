# Unit 5 — Business Rules

Decision rules, validation, and constraints for Review Workflow & State-Locking. Tech-agnostic.

## Review workflow (BR-RW)

### BR-RW1 Review identity & uniqueness
- `Review.id` is the internal UUID PK.
- `Review.displayId = REV-${nextval}` from `reviews_display_seq` (starts 100001), allocated by
  `ReviewNumberGenerator.allocate()`. Idempotent: if `displayId` is already set, returns the
  existing value (mirrors `ProjectNumberGenerator` pattern from U3).
- UNIQUE on `(projectId, phase)` AND on `displayId`.

### BR-RW2 Submit-for-review (US-7.1, FR-7.1, FR-7.2)
- `POST /projects/:projectId/reviews` with body `{ phase: ReviewPhase }`.
- Authorization: any active member of the project (`PROJECT_TEAM | GREEN_RATER`) or Admin.
  Reviewer cannot self-submit (BR-AS).
- Pre-conditions:
  - `Project.status` MUST be `REGISTERED`. Otherwise `409 Conflict`.
  - For `phase = FINAL`: there MUST exist `Review(phase=PRELIMINARY, status=RETURNED)` AND its
    `outcome ∈ { PASSED, PASSED_WITH_ISSUES }`. Otherwise `409 Conflict`.
  - For `phase = SUPPLEMENTAL`: there MUST exist `Review(phase=FINAL, status=RETURNED)` AND
    its `outcome = PASSED_WITH_ISSUES`. Otherwise `409 Conflict`.
  - There MUST NOT already be a `Review` row for `(projectId, phase)`. (Re-submit after a
    return is the same row mutating its own status — BR-RW8.)
  - The project MUST have at least one `attempted=true` credit on its scorecard. Otherwise
    `400 Bad Request`.
- Side effects (transactional):
  - Allocate `displayId`.
  - Insert `Review` row with `status = SUBMITTED`, `submittedAt = NOW()`,
    `submittedByUserId = actor.id`.
  - Flip `Project.status = UNDER_REVIEW` via `ProjectsService.transitionStatus(...)` (the U3
    state machine already allows REGISTERED → UNDER_REVIEW).
  - `AuditService.record({ entityType: 'Review.submitted', ... })`.
  - Fire `NotificationGateway.send({ kind: 'submission-confirmed', ... })` to project
    members (best-effort, post-commit).

### BR-RW3 Reviewer access during review
- Reviewer access to the project is granted via `ProjectMembership.projectRole = REVIEWER`
  (already implemented in U1). U5 does NOT auto-add a reviewer membership on submit — Admin
  must assign via BR-AS1 OR through the U1 invitation flow.
- The state-lock (BR-Z2) blocks `PROJECT_TEAM | GREEN_RATER` writes; Reviewer + Admin are
  allowed.

### BR-RW4 Award decisions (US-7.3, FR-7.5)
- `setAwarded(projectId, creditId, awardedPoints, actor)`:
  - Authorization: Reviewer (membership) OR Admin. Project Team / Green Rater rejected with 403.
  - State pre-condition: there MUST exist a `Review(projectId)` in status
    `SUBMITTED | DECIDED`. Otherwise `409 Conflict` ("no open review").
  - Award invariant (BR-RD1, FL-9 PBT-01 target): `0 ≤ awardedPoints ≤ verifiedPoints` for
    that credit. Out-of-range → `400 Bad Request`.
  - Side effects: write `ScorecardEntry.awardedPoints` (existing U2 column); bump entry
    `version`; if the review's `status = SUBMITTED`, transition to `DECIDED`; set
    `Review.reviewedByUserId = actor.id` and `Review.decidedAt = NOW()`.
  - `AuditService.record({ entityType: 'ScorecardEntry.awarded', ... })`.
- `awardAllVerified(projectId, reviewId, actor)`:
  - Authorization: Reviewer (membership) OR Admin.
  - State pre-condition: review status `SUBMITTED | DECIDED`.
  - Effect: for every `ScorecardEntry` on the project where `attempted = true`, set
    `awardedPoints = verifiedPoints`. Idempotent — already-awarded rows no-op (FL-11 PBT-01
    target).
  - Returns `{ updatedCount, summary }` where `summary` is the recomputed scorecard summary.
  - Single audit row `Review.awardAllVerified` plus per-entry version bumps.

### BR-RW5 Confirm review (US-7.4, FR-7.6)
- `POST /projects/:projectId/reviews/:reviewId/confirm` with body `{ outcome?: ReviewOutcome,
  reportNotes?: string }`.
- Authorization: Reviewer (the review's `reviewedByUserId` — or any project Reviewer when
  unset, e.g., when the team uses award-all-verified before any per-credit decision) OR Admin.
- State pre-condition: `Review.status ∈ { SUBMITTED, DECIDED }`.
- Side effects:
  - Auto-generate the report via `ReviewReportService.generateMarkdown(reviewId)`. Persist on
    `Review.reportMarkdown`, `reportGeneratedAt = NOW()`.
  - Compute `awardedTotal = Σ awardedPoints across attempted credits`.
  - Compute `certificationLevel` from `awardedTotal` against `RatingSystem.certificationLevels`
    (reuses the U2 calculator logic).
  - Determine `outcome`:
    - If body's `outcome` provided, use it (Admin/Reviewer can override).
    - Else derive: if every attempted credit has `awarded == verified` AND
      `certificationLevel != null` ⇒ `PASSED`; if some shortfalls but `certificationLevel !=
      null` ⇒ `PASSED_WITH_ISSUES`; else ⇒ `DENIED`.
  - Transition `Review.status = CONFIRMED`.
  - `AuditService.record('Review.confirmed', { outcome, certificationLevel, awardedTotal })`.

### BR-RW6 Return review (US-7.4, FR-7.6)
- `POST /projects/:projectId/reviews/:reviewId/return`.
- Authorization: Reviewer who confirmed OR Admin.
- State pre-condition: `Review.status = CONFIRMED`.
- Side effects (transactional):
  - Set `Review.status = RETURNED`, `returnedAt = NOW()`,
    `returnedByUserId = actor.id`.
  - Flip `Project.status = REGISTERED` (lifts the state-lock so the team can edit + resubmit
    if needed). The U3 `assertTransition` already allows `UNDER_REVIEW → REGISTERED`? **No** —
    U3 only allows `UNDER_REVIEW → CERTIFIED | DENIED`. Per BR-RW6 we extend the U3 transition
    map at code-gen time to add `UNDER_REVIEW → REGISTERED` (return path) — see BR-Z3 below.
  - Fire `NotificationGateway.send({ kind: 'review-returned', ... })` to project members
    (best-effort, post-commit).
  - `AuditService.record('Review.returned', ...)`.

### BR-RW7 Read paths
- `GET /projects/:projectId/reviews` — list all reviews (latest first).
- `GET /projects/:projectId/reviews/:reviewId` — single review including the report markdown.
- `GET /projects/:projectId/reviews/:reviewId/report` — text response (the markdown body) for
  download convenience.

### BR-RW8 Re-submission of a returned review (forward-compat)
- After RETURNED, the team may edit + call submit again FOR THE SAME PHASE. We accept this by
  resetting the existing review row's status back to `SUBMITTED` (with a new `submittedAt`
  timestamp; prior `submittedAt` preserved in `audit_log` only).
- Application enforces: if there is an existing `Review(projectId, phase)` and its `status =
  RETURNED`, submit re-uses the row. If `status` is mid-flight (`SUBMITTED | DECIDED |
  CONFIRMED`), submit returns `409`.

---

## Decisions (BR-RD)

### BR-RD1 Award range invariant (FL-9 PBT-01 target)
- For every persisted `ScorecardEntry` AFTER a Reviewer write: `0 ≤ awardedPoints ≤
  verifiedPoints`. Hard-rejected at write time. (Contrast with U2 BR-S6 where
  attempted/verified are override-friendly — awarded is strict.)
- Tier-locked credits: when `selectedPointValueId` is set, `verifiedPoints` is bounded by the
  selected tier's `points`. The award invariant still holds via `awarded ≤ verified ≤ tier`.

### BR-RD2 Per-column writer extension
- Extend the U2 `COLUMN_WRITERS` mapping in `ScorecardService` so that
  `awardedPoints: [Reviewer]`. Admin always passes via the global-role bypass (already
  implemented).

### BR-RD3 Reviewer per-credit comments
- Reviewer comments live in the existing U4 `VerificationNote.REVIEWER` column (BR-WN2 already
  authorizes Reviewer + Admin to write it). U5 reuses; no new comment entity.

---

## Report (BR-RP)

### BR-RP1 Pure markdown generator
- `ReviewReportService.generateMarkdown(input: ReportInput): string` is **pure** — no Nest
  imports, no I/O. Input includes the rating-system tree, project info, scorecard entries
  (joined to credit + category metadata), Reviewer notes (per credit), `awardedTotal`,
  certification level. Output is deterministic Markdown.

### BR-RP2 Report content (this build)
- Header: project display name, GBCI display ID, review phase, generated date.
- Summary table: overall awarded / verified / attempted / total available; certification level.
- Per-category table: awarded / verified / attempted; per-credit rows with `awarded ≤ verified
  ≤ attempted`, kind (credit/prerequisite), and a "Reviewer comment" column quoting the U4
  REVIEWER note.
- Footer: outcome, reviewed-by, confirmed-by, returned-by (when set).

### BR-RP3 Re-runnability
- Calling `generateMarkdown` twice with the same input ⇒ same output (PBT-01 candidate; not
  enforced as a property this build but the pure function permits it).
- The orchestrator at confirm time (BR-RW5) overwrites `Review.reportMarkdown` and bumps
  `Review.version`. Audit-recorded.

---

## Accept / continue (BR-AC)

### BR-AC1 Accept certification (US-7.6, FR-7.7)
- `POST /projects/:projectId/accept`.
- Authorization: Project Team OR Green Rater (active member) OR Admin.
- State pre-condition: there exists `Review(projectId)` with `status = RETURNED` AND `outcome
  ∈ { PASSED, PASSED_WITH_ISSUES }`. Use the latest review by `submittedAt DESC`.
- Side effects:
  - Project transitions `REGISTERED → CERTIFIED` (extends U3 transition map; see BR-Z3).
  - Record the certification level on the project (`Project.certificationLevel = review.
    certificationLevel` — note: this column is already on `Project.targetCertificationLevel`
    in U3; we add `Project.achievedCertificationLevel` to keep the two distinct).
  - `AuditService.record('Project.certified', ...)`.

### BR-AC2 Continue to next phase (US-7.6)
- `POST /projects/:projectId/continue-to-next-phase`.
- Authorization: same as Accept.
- State pre-condition: there exists `Review(projectId)` with `status = RETURNED`.
- Side effects:
  - Project status stays `REGISTERED` (BR-RW6 already lifted the lock at return time). The
    endpoint is idempotent: it just marks the team's intent in the audit log so dashboards can
    surface "next-phase pending".
  - `AuditService.record('Project.continueToNextPhase', { fromPhase: returnedReview.phase })`.

---

## Submittal Quality Score (BR-QS)

### BR-QS1 Authoritative on Reviewer entry
- `PUT /projects/:projectId/reviews/:reviewId/quality-score` with body `{ score: 0..5,
  notes?: string }`.
- Authorization: Reviewer (review owner) OR Admin.
- Effect: insert-or-update `SubmittalQualityScore` for `(projectId, reviewId)`. Bumps version.
- The score is authoritative the moment the Reviewer enters it; the Green Rater dashboard
  surfaces it on the next read (no async pipeline this build).

### BR-QS2 Revisable
- A Reviewer (review owner) or Admin can revise the score via the same PUT. Each revision
  produces an `AuditService.record('SubmittalQualityScore.revised', { before, after })`.

### BR-QS3 Read paths
- `GET /projects/:projectId/quality-scores` — returns the latest score per review for the
  project (member or Admin). U7 dashboards extend this with rollups.

---

## Reviewer assignment shortcut (BR-AS)

### BR-AS1 Admin-only assignment endpoint
- `POST /projects/:projectId/reviewers` with body `{ userId: UUID }`. Admin-only.
- Effect: idempotent `MembershipService.addMember(userId, projectId, REVIEWER, ...)`.
- The U1 invitation flow remains the canonical path for inviting a Reviewer who is not yet a
  user. The shortcut serves Admin operating on existing users (e.g., bench reviewers) and
  matches the U7 admin-pipeline view's needs.

---

## State-lock (BR-Z) — REAL implementation (US-11.2)

### BR-Z1 StateLockService.assertWritable
- New signature: `assertWritable(projectId: string, actor?: { userId: string; globalRole:
  GlobalRole }): void`.
- Logic:
  - If `actor` is undefined → no-op (system writes).
  - If `actor.globalRole = ADMIN` → return.
  - Look up `Project.status`. If `UNDER_REVIEW` → throw `ConflictException('Project is under
    review and cannot be edited.')`.
  - Otherwise return.
- The U2/U4 call sites (`ScorecardService`, `WorkbookService`, `ProjectsService.patch`,
  `SubmittalsService`, `ProjectsService.withdraw`) currently call `assertWritable(projectId)`
  with one argument. We extend each call site to pass the actor; backward compat is preserved
  for any system-write paths that don't have an actor.

### BR-Z2 Status transitions for review (extension to U3 state machine)
- Extend `ProjectStatus` allowed transitions in `project-status.machine.ts`:
  - Add `UNDER_REVIEW → REGISTERED` (BR-RW6 return path).
  - Add `REGISTERED → CERTIFIED` (BR-AC1 accept-from-prelim-passed path).
  - The original `UNDER_REVIEW → CERTIFIED | DENIED` remains.

### BR-Z3 Review-side state machine
- Define a new `review-status.machine.ts` with `assertTransition(from, to)` per the
  BR-RW1 transitions. Mirrors U3's project-status machine pattern; pure, no Nest imports;
  PBT-01 target FL-10.

### BR-Z4 Stateful invariant (FL-10)
- For any sequence of `(submit, setAwarded, awardAllVerified, confirm, return,
  accept|continue)` operations: the project never enters an illegal status, and the review
  never enters an illegal status. The pure `assertTransition` functions guarantee this; the
  property test (when added) generates random sequences and asserts both state machines
  reject illegal transitions.

---

## API behavior (summary)

### Read paths
- `GET /projects/:projectId/reviews` — list (member/Admin).
- `GET /projects/:projectId/reviews/:reviewId` — detail with report.
- `GET /projects/:projectId/reviews/:reviewId/report` — markdown text.
- `GET /projects/:projectId/quality-scores` — latest per review.

### Write paths
- `POST /projects/:projectId/reviews` — submit for review.
- `POST /projects/:projectId/reviews/:reviewId/award-all-verified` — bulk award.
- `POST /projects/:projectId/reviews/:reviewId/confirm` — internal confirm + report-gen.
- `POST /projects/:projectId/reviews/:reviewId/return` — release to GR.
- `POST /projects/:projectId/accept` — accept certification.
- `POST /projects/:projectId/continue-to-next-phase`.
- `PUT /projects/:projectId/reviews/:reviewId/quality-score`.
- `POST /projects/:projectId/reviewers` — admin assignment shortcut.

### Existing routes that change writers (no new endpoint)
- `PUT /projects/:projectId/scorecard/:creditId` — Reviewer is now in the `awardedPoints`
  writers list (BR-RD2).
