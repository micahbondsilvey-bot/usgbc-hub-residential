# Unit 2 — Business Logic Model

Business processes / algorithms for Unit 2 (LEED Catalog & Scorecard). Technology-agnostic.

## BL-1 Load Catalog (startup)

**Input**: `scripts/seed/leed-v41-sf-catalog.json` (hand-curated JSON; Q1=C).
**Output**: persisted `RatingSystem`, `CreditCategory`, `Credit`, `CreditPointValue` rows; in-memory
catalog cache populated.
**Steps**:
1. Read JSON. Validate shape against a TypeScript schema.
2. For each rating system:
   1. Upsert `RatingSystem` keyed by `(version, program)`.
   2. For each category, upsert `CreditCategory` keyed by `(ratingSystemId, slug)`.
   3. For each credit, upsert `Credit` keyed by `(categoryId, slug)` and tier rows on
      `CreditPointValue` keyed by `(creditId, tierLabel)`.
   4. Run BR-C3/BR-C4 validations: integrity (FKs, kind/points), totals, certification levels.
3. Stamp every insert/update with `AuditStampHelper.stampSystem*`.
4. Populate `CatalogService` in-memory cache (Q14=A).
5. Log a single info line: "Catalog seeded — N categories, M credits, K tiers."

## BL-2 Get Catalog

**Input**: `ratingSystemId` (or `slug`).
**Output**: `RatingSystemDto` with nested categories → credits → tiers.
**Steps**:
1. If cached, return the cached snapshot.
2. Otherwise read from DB and populate the cache.

## BL-3 Initialize Scorecard for a Project

Triggered when a project is registered (Unit 3 will call this; Unit 2 ships the entry point).
**Input**: `projectId`, `ratingSystemId`, optional `actorUserId`.
**Output**: a `ScorecardEntry` row per credit in the rating system, with prereqs `attempted=true`
and optionals `attempted=false`, all point columns `0`.
**Steps**:
1. Resolve all credits in the rating system from the cache.
2. For each, insert a `ScorecardEntry` with:
   - `attempted = (credit.kind === 'prerequisite')`,
   - `attemptedPoints = verifiedPoints = awardedPoints = 0`,
   - `version = 1`,
   - `selectedPointValueId = null`.
3. Audit-stamp via the system or actor helper.

## BL-4 Toggle Attempted on a Credit

**Input**: `projectId`, `creditId`, `attempted: boolean`, `actor`.
**Output**: updated `ScorecardEntry`.
**Steps**:
1. Authorize: actor's project role on the project must be `PROJECT_TEAM`, `GREEN_RATER`, or `Admin`.
2. Load the entry for `(projectId, creditId)`.
3. If `credit.kind === 'prerequisite'` and `attempted === false` → 400 (BR-S3).
4. If `attempted` is unchanged → no-op return.
5. If `attempted === false` (BR-S7 soft-clear): zero `attemptedPoints/verifiedPoints/awardedPoints`,
   set `attempted = false`, increment `version`. Audit-stamp.
6. Else: set `attempted = true`, increment `version`. Audit-stamp.
7. Record an `AuditLog` row (`entityType: 'ScorecardEntry.attempted'`, `before/after`).
8. Persist; return the entry.

## BL-5 Set Points on a Credit

**Input**: `projectId`, `creditId`, partial `{ attemptedPoints?, verifiedPoints?, awardedPoints?,
selectedPointValueId? }`, `actor`.
**Output**: updated `ScorecardEntry` + `warnings[]`.
**Steps**:
1. Authorize per BR-S2 (column-level): only writers of each column are allowed to set it; reject
   400 if a write attempts to set a column outside the actor's permissions.
2. Reject 400 on negative values (BR-S4).
3. If `selectedPointValueId` is provided:
   - Validate it belongs to `creditId`. Reject 400 otherwise.
   - Set `attemptedPoints` to that tier's `points` (overwrites any concurrent value).
4. Apply remaining patch fields. Increment `version`.
5. Compute warnings (BR-S6): for each touched column, if value is outside
   `[credit.pointsMin, credit.pointsMax]`, emit a `warning` (do NOT reject).
6. Audit-stamp via the controller-level interceptor.
7. Persist; return entry + warnings.

## BL-6 Get Scorecard

**Input**: `projectId`, optional `ratingSystemId` filter.
**Output**: `ScorecardDto = { entries: ScorecardEntryDto[], summary: ScorecardSummary, warnings: Warning[] }`.
**Steps**:
1. Authorize: actor must be Admin or have any active membership on the project.
2. Load all entries for the project. Join the catalog (from cache).
3. Compute summary via `ScorecardSummaryCalculator.compute(...)`.
4. Compute warnings list against current entries.
5. Return.

## BL-7 ScorecardSummaryCalculator (pure module — Q12=A)

Pure functions; no NestJS or DB dependencies. Backend lives at
`src/scorecard/calculator/scorecard-summary.calculator.ts`. The frontend reimplements the same
contract under `src/app/features/scorecard/scorecard-summary.calc.ts` (Q6=A). Identical inputs and
outputs; documented in code comments cross-referencing each other.

### compute(entries, catalog) → ScorecardSummary

Inputs:
- `entries: ScorecardEntry[]` — all entries for the project.
- `catalog: { ratingSystem, categories, credits, tiers }` — the catalog snapshot.

Output:
```
ScorecardSummary {
  perCategory: Array<{
    categoryId, categorySlug, name,
    attempted, verified, awarded,
    attemptedPointsAvailable, awardedPointsAvailable
  }>,
  overall: { attempted, verified, awarded, totalAvailable },
  certificationLevel: 'Certified' | 'Silver' | 'Gold' | 'Platinum' | null
}
```

### deriveCertificationLevel(awarded, certificationLevels) → string | null

- Iterates `certificationLevels` low → high.
- Returns the `name` of the level whose `[minPoints, maxPoints]` (max nullable = ∞) contains
  `awarded`.
- Returns `null` when `awarded < lowest minPoints`.

### PBT-01 Properties (carry-over)

Documented for each pure function. Tests are skipped per the documented PBT deviation (Unit 1)
unless the user re-enables them.

1. **Determinism** — `compute(es, c) === compute(es, c)` for any inputs. Pure.
2. **Sum invariant** — `overall.attempted = Σ perCategory.attempted` (and likewise for verified/awarded).
3. **Available-points consistency** — `overall.totalAvailable = Σ catalog.credits[where kind=credit].pointsMax`
   for the rating system referenced by `entries[*].creditId`.
4. **Inclusion** — `entries` not flagged as `attempted = true` contribute zero to all sums.
5. **Order independence** — `compute(shuffle(entries), c) === compute(entries, c)`.
6. **Threshold partition** — for any `awarded` and a valid `certificationLevels` array, exactly
   zero or one threshold contains it; if `awarded < lowestMinPoints` → null; if
   `awarded >= highestMinPoints` → highest level (since highest `maxPoints = null`).
7. **Override permissiveness** — values outside per-credit `[pointsMin, pointsMax]` still flow
   through the sums (i.e., the sums are not silently clamped). Warnings are reported separately.

## BL-8 Demo Seed (BR-D)

**Inputs**: nothing; `OnModuleInit`.
**Outputs**: a placeholder demo project row, demo memberships reconciled, a demo scorecard pre-populated.
**Steps**:
1. Insert/update the placeholder project with id `<DEMO_PROJECT_UUID>` and GBCI id
   `RES-DEMO-001`. (Unit 3 will replace this row with the canonical `Project` entity.)
2. For each demo user (`team@`, `rater@`, `reviewer@`), call
   `MembershipService.addMember(userId, demoProjectId, role, invitedBy=null, actor=null)`. The
   helper is idempotent (Unit 1 BR-Z); if the user already has a different role, log and skip.
3. Initialize the scorecard via `BL-3`.
4. Apply a curated set of `attemptedPoints` on a small subset of optional credits so the live
   summary computes to a Silver-band awarded total. Idempotent on re-runs (re-running won't
   overwrite a user's edits — it only seeds rows whose audit fields are still
   `createdBy = updatedBy = null`).

## API Endpoints (Unit 2)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/catalog/rating-systems/:id` | bearer | Catalog tree (cached) |
| GET | `/api/v1/catalog/rating-systems` | bearer | List rating systems |
| GET | `/api/v1/projects/:projectId/scorecard` | bearer + member/Admin | Entries + summary + warnings |
| PUT | `/api/v1/projects/:projectId/scorecard/:creditId` | bearer + project role per BR-S2 | Update entry |
| POST | `/api/v1/projects/:projectId/scorecard/:creditId/un-attempt` | bearer + project role | BR-S7 soft-clear |
| GET | `/api/v1/projects/:projectId/scorecard/summary` | bearer + member/Admin | Authoritative summary only |
