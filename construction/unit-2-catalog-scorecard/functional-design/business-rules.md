# Unit 2 — Business Rules

Decision rules, validation, and constraints for the LEED Catalog & Scorecard. Technology-agnostic.

## Catalog (BR-C)

### BR-C1 Catalog source of truth
- The catalog is loaded from `scripts/seed/leed-v41-sf-catalog.json` (hand-curated from the LEED
  v4.1 SF rating system PDF) by a `CatalogSeeder` running `OnModuleInit` (Q1=C).
- The verification submittal worksheet (`docs/LEED_v4.1_SF_Verification_Submittals_Worksheet.xlsx`)
  is **NOT** parsed in this unit; Unit 4 (Workbook) parses it to produce per-credit verification
  field and submittal slot definitions.

### BR-C2 Idempotent seeding
- The seeder upserts `RatingSystem`, `CreditCategory`, and `Credit` rows by their stable slugs
  (`(version, program)` for rating system; `(ratingSystemId, slug)` for category;
  `(categoryId, slug)` for credit).
- Re-running the seeder must not create duplicates and must update fields that have changed in the
  JSON (e.g., a corrected `requirementsSummary`).
- Audit fields on seeded rows are populated via `AuditStampHelper.stampSystemInsert/Update` since
  seed runs outside the HTTP path.

### BR-C3 Catalog integrity
- A `CreditCategory` belongs to exactly one `RatingSystem`.
- A `Credit` belongs to exactly one `CreditCategory`.
- A `Credit` with `kind = 'credit'` MUST have `pointsMin >= 0` and `pointsMax >= pointsMin` and
  `pointsMax >= 1`.
- A `Credit` with `kind = 'prerequisite'` MUST have `pointsMin = pointsMax = 0` (or null).
- `RatingSystem.totalPointsAvailable` MUST equal `Σ(credit.pointsMax)` across all
  `kind='credit'` credits in that rating system. The seeder validates and fails fast if not.

### BR-C4 Certification levels (Q3=A)
- Stored on `RatingSystem.certificationLevels`.
- The seeder validates: the array is non-empty, levels are listed in increasing-points order,
  ranges are contiguous (the next level's `minPoints` equals previous `maxPoints + 1`), the
  highest-level row has `maxPoints = null`, and `minPoints <= RatingSystem.totalPointsAvailable`
  for every threshold.
- For LEED v4.1 SF (per the rating-system PDF):
  - `Certified`: 40–49
  - `Silver`: 50–59
  - `Gold`: 60–79
  - `Platinum`: 80+

## Scorecard (BR-S)

### BR-S1 At-most-one entry per (project, credit)
- Enforced by a unique index on `ScorecardEntry(projectId, creditId)`.

### BR-S2 Independent point columns (Q4=A)
- `attemptedPoints`, `verifiedPoints`, and `awardedPoints` are independent integer fields.
- The contract `Awarded ≤ Verified ≤ Attempted` is documented as a **soft expectation** for
  reporting; it is NOT enforced server-side because the override behavior in BR-S6/Requirements
  3.3.3 explicitly permits values out of range.
- Authoritative writers per column:
  - `attempted` toggle and `attemptedPoints`: Project Team / Green Rater (own scorecard) and Admin.
  - `verifiedPoints`: Green Rater and Admin.
  - `awardedPoints`: **Reviewer only** (and Admin) — Unit 5 owns this writer; Unit 2 ships the
    column and read paths.

### BR-S3 Prerequisite locking
- `attempted` is forced to `true` for any `ScorecardEntry` where the linked `Credit.kind =
  'prerequisite'`.
- The application layer raises `400 Bad Request` if a write attempts to set `attempted = false` on
  a prerequisite credit (the FE renders the toggle as locked-on per Q3.2.3).

### BR-S4 Point entry semantics
- `attemptedPoints`, `verifiedPoints`, `awardedPoints` MUST be non-negative integers.
- `Math.MAX_SAFE_INTEGER`-bounded; in practice the response includes a warning when an entry is
  outside the credit's `[pointsMin, pointsMax]` (BR-S6).

### BR-S5 Tiered credits
- When a credit has `CreditPointValue` rows, `selectedPointValueId` MUST point at a tier belonging
  to that credit, and `attemptedPoints` MUST equal that tier's `points`.
- When a credit has NO `CreditPointValue` rows, `selectedPointValueId` MUST be null.
- Selecting a different tier overwrites `selectedPointValueId` and `attemptedPoints` atomically.

### BR-S6 Out-of-range override (Requirements 3.3.3)
- When a write sets a point column outside the credit's `[pointsMin, pointsMax]` range:
  - The value IS persisted (no rejection).
  - The response (and any subsequent read) includes a `warnings` array entry of the form:
    ```
    { creditId, column: 'attempted'|'verified'|'awarded', value, allowedMin, allowedMax,
      reason: 'value_out_of_credit_range' }
    ```
  - The frontend live-summary surface reflects the same warnings.
- Negative values are rejected (400) — the override applies to "out of credit range," not to
  fundamentally invalid integers.

### BR-S7 Attempted toggle off (Q5=A)
- Setting `attempted = false` on an optional credit:
  - Triggers a confirmation prompt on the FE (`"Clear entered points for this credit?"`).
  - On confirmation, soft-clears `attemptedPoints/verifiedPoints/awardedPoints` to `0` and saves
    the row (`attempted` becomes `false`). The row is preserved.
  - Re-toggling `attempted = true` later restores nothing — the user enters fresh values.

### BR-S8 Live summary computation
- The summary aggregates per category and overall:
  - `attempted`: Σ `attemptedPoints` across attempted credits.
  - `verified`: Σ `verifiedPoints` across attempted credits.
  - `awarded`: Σ `awardedPoints` across attempted credits.
- The certification level is derived from the **awarded total** against
  `RatingSystem.certificationLevels` (BR-C4):
  - Iterate levels in declared order (low → high). The level whose
    `[minPoints, maxPoints || +∞]` contains `awarded` is the result.
  - When `awarded < lowestMinPoints`, return `null` (no level achieved).
- The frontend recomputes locally for instant feedback (Q11=A); the backend is **authoritative**
  on persisted reads.

### BR-S9 Concurrency (Q13=A)
- Last-write-wins on a per-cell update. The `version` column on `ScorecardEntry` increments by 1
  on every persisted change to be ready for optional optimistic locking later. Not enforced this
  build.

### BR-S10 Audit semantics
- Every `ScorecardEntry` write is audit-stamped via the controller-level `AuditStampInterceptor`
  (Unit 1 Q2=B); changes that materially flip a column also produce an explicit `AuditService.record`
  row (`entityType: 'ScorecardEntry.{column}'`, `before/after` of the affected column) so the
  per-cell history is queryable.
- For now the explicit `AuditService.record` is fired only on `attempted` flips (most material);
  numeric edits rely on the entity-level audit columns.

## Demo Seed (BR-D)

### BR-D1 Demo project for end-to-end demo (Q8=A)
- Unit 2 seeds a single placeholder project row with a fixed UUID and GBCI display id
  `RES-DEMO-001`. This is a **transient placeholder** — Unit 3's `Project` entity replaces it.
- The Unit 1 demo memberships (`team@`, `rater@`, `reviewer@`) are reconciled onto this project
  via `MembershipService.addMember` with system-actor stamping.

### BR-D2 Demo scorecard
- The seeder pre-populates a partial scorecard for the demo project with all prerequisites
  `attempted=true` (BR-S3 enforces this) and a curated subset of optional credits attempted with
  representative `attemptedPoints` so the live summary lands in the `Silver` band — useful for
  presentations.

## API behavior

### BR-A1 Read paths
- `GET /api/v1/catalog/rating-systems/:id` returns the rating system, categories, credits, and
  tier values; cacheable in memory (Q14=A).
- `GET /api/v1/projects/:projectId/scorecard` returns the project's scorecard with attempted
  credits, point columns, current `version`, and a `summary` object (totals + level + warnings).

### BR-A2 Write paths
- `PUT /api/v1/projects/:projectId/scorecard/:creditId` updates `attempted`,
  `attemptedPoints`, `verifiedPoints`, `awardedPoints` (per role permissions on each column —
  see BR-S2).
- `POST /api/v1/projects/:projectId/scorecard/:creditId/un-attempt` performs BR-S7's soft-clear.
- All scorecard writes route through `ScorecardService` and are subject to `ProjectRolesGuard`.

### BR-A3 Authorization
- Catalog reads: any authenticated user.
- Scorecard reads: any active member of the project (`PROJECT_TEAM | GREEN_RATER | REVIEWER`) or Admin.
- Scorecard writes: per-column rules (BR-S2). Admin bypasses.
- The state-lock from Unit 5 (BR-Z2) will gate writes when a project is `UNDER_REVIEW`; Unit 2
  exposes a hook (`StateLockService.assertWritable(projectId)`) that today is a no-op.
