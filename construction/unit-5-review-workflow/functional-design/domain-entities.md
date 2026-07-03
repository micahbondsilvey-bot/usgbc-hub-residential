# Unit 5 — Domain Entities

Tech-agnostic domain model for Review Workflow & State-Locking. All persisted entities inherit
`AuditBase` from Unit 1.

Decisions reflected (all-A from `unit-5-review-workflow-design-plan.md`):
- Q1=A one `Review` per `(project, phase)` with status lifecycle.
- Q2=A `PRELIMINARY | FINAL | SUPPLEMENTAL` enum + ordering rules.
- Q3=A reviewer writes to `ScorecardEntry.awardedPoints` directly (no new CreditDecision entity).
- Q5=A `Review.reportMarkdown` TEXT column.
- Q6=A two-step return (confirm → return).
- Q9=A `SubmittalQualityScore` entity.
- Q10=A real `StateLockService` implementation.

---

## Review

The single source of truth for one phase's review on a project (BR-RW1..BR-RW8).

- `id: UUID` (PK)
- `displayId: string` — sequential `REV-${nextval}` from `reviews_display_seq` (start 100001).
  UNIQUE.
- `projectId: UUID` — soft FK forward-declared, matches U2/U3/U4 patterns.
- `phase: ReviewPhase` enum (`PRELIMINARY | FINAL | SUPPLEMENTAL`).
- `status: ReviewStatus` enum:
  - `OPEN` — placeholder seldom used; review is `SUBMITTED` immediately on create.
  - `SUBMITTED` — Green Rater has submitted; project is `UNDER_REVIEW`.
  - `DECIDED` — Reviewer has finished award decisions but not yet confirmed the report.
  - `CONFIRMED` — Reviewer confirmed the auto-generated report internally; awaiting return.
  - `RETURNED` — released to the Green Rater; lock lifted.
- `outcome: ReviewOutcome | null` — populated at confirm time:
  - `PASSED` — every attempted credit was fully awarded (`awarded == verified` for all).
  - `PASSED_WITH_ISSUES` — some credits awarded less than verified (or 0).
  - `DENIED` — total awarded points fall below the lowest certification threshold.
  - `null` while `status ∈ { OPEN, SUBMITTED, DECIDED }`.
- `submittedByUserId: UUID` — actor on submit.
- `submittedAt: timestamp` — set on the SUBMITTED transition.
- `reviewedByUserId: UUID | null` — Reviewer who entered decisions; populated on first
  `setAwarded` call.
- `decidedAt: timestamp | null` — when `status = DECIDED` was reached (last decision saved
  before confirm).
- `confirmedByUserId: UUID | null` — Reviewer (or Admin) who confirmed the report.
- `confirmedAt: timestamp | null`.
- `returnedByUserId: UUID | null`.
- `returnedAt: timestamp | null`.
- `reportMarkdown: text | null` — auto-generated Markdown of the review report (BR-RP1..BR-RP3).
- `reportGeneratedAt: timestamp | null`.
- `awardedTotal: integer | null` — denormalized sum of awarded points across attempted credits
  at confirm time. Recomputed on every report generation.
- `certificationLevel: string | null` — denormalized from awardedTotal vs. rating-system
  thresholds. Authoritative for accept-flow.
- `version: integer` — increments on every persisted change.
- inherits `AuditBase`.

Constraints / invariants:
- `(projectId, phase)` UNIQUE — at most one review per phase per project.
- `displayId` UNIQUE.
- Status transitions enforced by `ReviewStatusTransition.assertTransition(...)` (PBT-01 target
  FL-10):
  - `OPEN → SUBMITTED`
  - `SUBMITTED → DECIDED`
  - `SUBMITTED → CONFIRMED` (when reviewer skips per-credit decisions and uses award-all-verified)
  - `DECIDED → CONFIRMED`
  - `CONFIRMED → RETURNED`
  - All other transitions throw.
- Outcome MAY only be set when `status ∈ { CONFIRMED, RETURNED }`.
- A second `Review(phase=FINAL)` row may only exist when `Review(phase=PRELIMINARY).status =
  RETURNED` AND `outcome ∈ { PASSED, PASSED_WITH_ISSUES }`. Application enforces.

## SubmittalQualityScore

Authoritative quality score per review per project (BR-QS1..BR-QS3).

- `id: UUID`
- `projectId: UUID`
- `reviewId: UUID` (FK → `Review`)
- `score: integer` — 0..5 inclusive.
- `notes: text | null` — short reviewer/admin commentary.
- `enteredByUserId: UUID` — Reviewer or Admin actor.
- `enteredAt: timestamp` — set on every save.
- `version: integer`
- inherits `AuditBase`.

Constraints:
- `(projectId, reviewId)` UNIQUE.
- `score` ∈ [0, 5].
- Updates allowed by Reviewer (only on the review they own) or Admin (any). Audit-recorded with
  `before/after` for every revision.

---

## Enums (definitive)

```ts
export enum ReviewPhase {
  PRELIMINARY = 'PRELIMINARY',
  FINAL = 'FINAL',
  SUPPLEMENTAL = 'SUPPLEMENTAL',
}

export enum ReviewStatus {
  OPEN = 'OPEN',
  SUBMITTED = 'SUBMITTED',
  DECIDED = 'DECIDED',
  CONFIRMED = 'CONFIRMED',
  RETURNED = 'RETURNED',
}

export enum ReviewOutcome {
  PASSED = 'PASSED',
  PASSED_WITH_ISSUES = 'PASSED_WITH_ISSUES',
  DENIED = 'DENIED',
}
```

Plus a forward-compat extension to U2's `SetPointsDto` writer rules: U5 wires `Reviewer` into
the `awardedPoints` column writers (BR-RD2). No schema change to `ScorecardEntry`.

---

## Sequences

One new Postgres sequence created via `RegistrationDdlBootstrapper`-style hook in U5 (or
extended on the existing one):

- `reviews_display_seq` — starts at `100001`, no cycle.

`Review.displayId` is `REV-${nextval}`. The DDL bootstrap is idempotent; we extend the
existing `RegistrationDdlBootstrapper` to also create this sequence.

---

## Relationships (text)

```
Project (U3) 1 ── 0..* Review                 (one per phase)
            1 ── * ScorecardEntry              (← U2; awardedPoints written by Reviewers in U5)
            1 ── * ProjectMembership           (← U1; REVIEWER role used to gate writes)

Review 1 ── 0..1 SubmittalQualityScore         (one per review)
       1 ── 0..1 reportMarkdown (column on the same row)
```

---

## Out of scope (this unit)

- Real PDF / DOCX report rendering (deferred).
- Notification framework / persistence (U7) — U5 only fires the existing U1 mock gateway.
- Batch submit (U6 portfolio).
- MS Bookings scheduling (U9).
- Admin dashboards over reviews (U7).
