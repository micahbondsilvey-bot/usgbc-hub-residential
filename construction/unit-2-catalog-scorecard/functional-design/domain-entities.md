# Unit 2 — Domain Entities

Technology-agnostic domain model for Unit 2 (LEED Catalog & Scorecard). All persisted entities
inherit `AuditBase` from Unit 1 (`createdAt/updatedAt/createdBy/updatedBy`).

Decisions reflected: Q1=C hand-curated JSON catalog seed (worksheet → U4); Q2=B rich credit data
(referenceGuideUrl, intent, tags); Q3=A certification thresholds in `RatingSystem`;
Q4=A independent integer columns; Q5=A soft-clear on un-attempt; Q13=A last-write-wins with
forward-compatible `version` column.

## RatingSystem

The top-level container — e.g., "LEED v4.1 Residential Single Family". Made into a lookup table
(NFR-2.4) so future rating systems can be added by data.

- `id: UUID` (PK)
- `slug: string` — stable machine identifier, e.g., `leed_v4_1_sf`. Unique.
- `name: string` — human label, e.g., `LEED v4.1 Residential Single Family`.
- `version: string` — e.g., `v4.1`.
- `program: string` — `residential_sf` (room for `residential_mf`, `commercial`, etc.).
- `totalPointsAvailable: integer` — sum of available credit points across categories.
- `certificationLevels: JSON` — ordered array of threshold definitions (Q3=A):
  ```json
  [
    { "name": "Certified", "minPoints": 40, "maxPoints": 49 },
    { "name": "Silver",    "minPoints": 50, "maxPoints": 59 },
    { "name": "Gold",      "minPoints": 60, "maxPoints": 79 },
    { "name": "Platinum",  "minPoints": 80, "maxPoints": null }
  ]
  ```
  (Exact values are seeded from the LEED v4.1 SF rating system PDF.)
- `effectiveAt: Date` — when this rating system becomes available for new projects.
- `retiredAt: Date | null` — when no longer offered.
- inherits `AuditBase`.

Constraints / invariants:
- `slug` and `(version, program)` are both unique.
- `certificationLevels` ranges are contiguous (no gaps), strictly increasing, and the highest level
  has `maxPoints = null` (open-ended). Validated at seed time.

## CreditCategory

A grouping like "Location and Transportation" or "Energy and Atmosphere".

- `id: UUID`
- `ratingSystemId: UUID` (FK → `RatingSystem`)
- `slug: string` — e.g., `lt`, `ss`, `wa`, `ea`, `mr`, `eq`, `in`, `rp`.
- `name: string` — e.g., "Location & Transportation".
- `displayOrder: integer` — used to render rows in canonical order.
- `iconRef: string | null` — icon key for the FE (`'leed-icon-lt'` etc.).
- inherits `AuditBase`.

Constraints:
- `(ratingSystemId, slug)` unique.

## Credit

A single credit or prerequisite. Carries the rich data per Q2=B.

- `id: UUID`
- `categoryId: UUID` (FK → `CreditCategory`)
- `slug: string` — stable id within a category, e.g., `lt_credit_compact_development`.
- `name: string` — title.
- `kind: 'prerequisite' | 'credit'` — drives the locked-on toggle and counts toward total.
- `pointsMin: integer | null` — null for prerequisites; otherwise minimum awardable.
- `pointsMax: integer | null` — null for prerequisites; otherwise maximum awardable
  (equal to `pointsMin` for fixed-value credits).
- `intent: text | null` — short statement of the credit's intent (Q2=B).
- `requirementsSummary: text | null` — short paraphrase of the credit's requirements (not the full
  reference text).
- `referenceGuideUrl: string | null` — external doc link (Q2=B).
- `tags: string[]` — categorical tags for filtering, e.g., `['water', 'efficiency']` (Q2=B).
- `displayOrder: integer` — order within category.
- inherits `AuditBase`.

Constraints:
- `(categoryId, slug)` unique.
- For `kind = 'prerequisite'`: `pointsMin = pointsMax = null` (or `0/0`).
- For `kind = 'credit'`: `pointsMin >= 0`, `pointsMax >= pointsMin`, `pointsMax >= 1`.

## CreditPointValue (optional, present when modeling tiers)

Some credits award points by performance tier. Shipping this table now keeps tiered-point credits
modelable; a fixed-point credit can omit any rows here.

- `id: UUID`
- `creditId: UUID` (FK → `Credit`)
- `tierLabel: string` — e.g., `Path 1 — 5%`, `Path 2 — 10%`.
- `points: integer`
- `displayOrder: integer`
- inherits `AuditBase`.

Constraints:
- `(creditId, tierLabel)` unique.
- `points` between `Credit.pointsMin` and `Credit.pointsMax` inclusive.

> A credit is fixed-point when `CreditPointValue` has no rows for that credit.

## ScorecardEntry

Per-project, per-credit point entry. The single source of truth for a project's scorecard state.

- `id: UUID`
- `projectId: UUID` — FK forward-declared (Project lives in Unit 3).
- `creditId: UUID` (FK → `Credit`)
- `attempted: boolean` — true when the project is pursuing this credit. Forced `true` when
  `Credit.kind = prerequisite` (BR-S5). Defaults to `true` for prereqs and `false` for optional.
- `attemptedPoints: integer` — points the project plans to claim. `0` when `attempted = false`.
- `verifiedPoints: integer` — points the Green Rater verified in the field.
- `awardedPoints: integer` — points the Reviewer awarded.
- `selectedPointValueId: UUID | null` — when the credit has tiers (`CreditPointValue` rows), the
  tier the project selected; null otherwise.
- `version: integer` — increments by 1 on every update (Q13=A, optimistic-lock-ready).
- `notes: text | null` — short annotation surface (the rich three-column notes belong to U4).
- inherits `AuditBase`.

Constraints / invariants:
- `(projectId, creditId)` unique — at most one row per credit per project.
- For prerequisites: `attempted` is enforced to `true` at the application layer.
- All point columns are `>= 0` integers. Out-of-range relative to the credit's
  `[pointsMin, pointsMax]` is **flagged but accepted** per Requirements 3.3.3 (override-allowed).
- `version` is set by the application on each save and is for forward use; not enforced for
  optimistic locking this build (Q13=A).

## DemoProject (transient — Unit 3 owns the real Project entity)

Unit 2 seeds a placeholder row with `id = <fixed UUID>` and a GBCI display id `RES-DEMO-001`
(Q8=A) so the scorecard UI has something to render. Unit 3 will replace this row with the real
`Project` entity on first run; FK from `ScorecardEntry.projectId` references that.

## Relationships (text)

```
RatingSystem 1 ── * CreditCategory 1 ── * Credit 1 ── * CreditPointValue
                                              ▲
                                              │ (FK creditId)
ScorecardEntry * ── 1 Credit
ScorecardEntry * ── 1 (Project — Unit 3)
```

## Out of scope (this unit)

- Verification field definitions and submittal slot definitions per credit — Unit 4 (Workbook).
  The catalog rows in this unit do NOT include those; the per-credit data on `Credit` (intent,
  requirementsSummary, tags, referenceGuideUrl) is intentionally lightweight.
- Project entity, registration flow, fees — Unit 3.
- Reviews, awards, state-locking — Unit 5 (this unit owns the columns but never sets
  `awardedPoints` server-authoritatively; that path is owned by Unit 5).
