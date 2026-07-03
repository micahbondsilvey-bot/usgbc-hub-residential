# Unit 2 — NFR Requirements

Unit-2-specific non-functional requirements. Globally pinned NFRs (NestJS / Angular 20.2 / Postgres
/ local-only / PBT-tests-deferred / security & resiliency baselines OFF) apply too.

## Scalability

### NFR-U2-1.1 Local single-user / small-team scale
- Same shape as Unit 1: a single backend instance, single Postgres, ≤ 25 concurrent demo users.
- Catalog reads dominate; cached in-process so DB read pressure stays trivial.

### NFR-U2-1.2 Catalog cardinality
- LEED v4.1 SF: ~8 categories, ~50–80 credits, ~0–N tiers per credit.
- The full catalog easily fits in a single in-process map (< 100 KB JSON when serialized).

### NFR-U2-1.3 Scorecard cardinality
- Per project: roughly one entry per credit (≈ 60–80 rows).
- Across the demo dataset, the scorecard table holds tens of thousands of rows at most for years
  to come — well within Postgres scan limits.

## Performance (Q9=A)

### NFR-U2-2.1 Latency targets (single-user, local)
- `GET /api/v1/catalog/rating-systems/:id` p95 **≤ 100 ms** (cached-in-memory after first call).
- `GET /api/v1/catalog/rating-systems` p95 **≤ 50 ms**.
- `GET /api/v1/projects/:projectId/scorecard` p95 **≤ 200 ms**.
- `GET /api/v1/projects/:projectId/scorecard/summary` p95 **≤ 100 ms**.
- `PUT /api/v1/projects/:projectId/scorecard/:creditId` p95 **≤ 150 ms**.
- `POST .../scorecard/:creditId/un-attempt` p95 **≤ 150 ms**.
- **Frontend**: live summary recompute < 16 ms (target: one frame). Achieved by keeping the
  `entries` map in a Signal and computing summaries via `computed()` graphs.

### NFR-U2-2.2 Catalog cache
- The catalog is cached in process memory by `CatalogService`. Cache miss path reads through
  TypeORM, populates, returns. Cache invalidated when `CatalogSeeder` runs (NFR-U2-6.1).

## Availability

### NFR-U2-3.1 Demo-grade availability
- Same as Unit 1: best-effort during local demos. The seeder fails fast on validation errors so
  bad catalog data never reaches the API surface.

## Security

### NFR-U2-4.1 Authorization (extends Unit 1 BR-Z2)
- Catalog reads: any authenticated user.
- Scorecard reads: requires global Admin OR active membership (`PROJECT_TEAM | GREEN_RATER |
  REVIEWER`) on the target project.
- Scorecard writes: per-column rules per BR-S2 (see `business-rules.md`):
  - `attempted` and `attemptedPoints`: PT, GR, Admin.
  - `verifiedPoints`: GR, Admin.
  - `awardedPoints`: Admin only this build (Reviewer write path lands in Unit 5).
- The state-lock hook from Unit 5 (`StateLockService.assertWritable(projectId)`) is invoked but is
  a no-op until Unit 5 ships.

### NFR-U2-4.2 Audit
- All scorecard writes inherit `AuditBase` (Unit 1 mixin) so `createdAt/updatedAt/createdBy/updatedBy`
  are stamped via the controller-level interceptor.
- `attempted` flips additionally produce `AuditLog` rows via explicit `AuditService.record(...)`
  (BR-S10) so the per-cell history is queryable.

## Reliability (Q10=A — input validation override)

### NFR-U2-5.1 Override-friendly validation
- Backend accepts any non-negative integer; out-of-credit-range values are accepted and **flagged**
  in the response `warnings` array (per Requirements 3.3.3 / BR-S6).
- Both the frontend live-summary surface and the backend authoritative summary include the same
  warnings list. The contract is identical.

### NFR-U2-5.2 Concurrency (Q13=A — last-write-wins)
- Scorecard writes are last-write-wins on a per-cell basis. The `version` column on
  `ScorecardEntry` increments on every persisted change but is **not** enforced for optimistic
  locking this build. Documented in OpenAPI so clients know not to rely on the value yet.

## Maintainability

### NFR-U2-6.1 Quality gates
- ESLint + Prettier clean (single quotes, 100-col).
- TypeScript strict.
- Catalog seeder runs at startup; idempotent; fails fast on schema or invariant violations.
- Module structure mirrors the Unit 2 plan: `src/catalog/`, `src/scorecard/`, `src/scorecard/calculator/`.

### NFR-U2-6.2 Property-Based Testing
- Carry-over from Unit 1: `fast-check` is the framework; tests for the calculator are described
  in `business-logic-model.md` BL-7. **Tests remain skipped per the documented PBT deviation
  (Unit 1).** Enable later by re-running the deferred test steps without code-side rework.

### NFR-U2-6.3 Logging
- Reuse the existing `Logger`. Catalog seeding logs counts (`info`); scorecard writes log
  `event` + `actorUserId` + `creditSlug` + `warnings.length`. No PII in scorecard writes; no
  cleartext tokens cross this unit.

## Frontend State (Q11=A)

### NFR-U2-7.1 Signal-based feature store
- `features/scorecard/scorecard.store.ts` holds the active project's catalog, entries, and
  per-actor permissions in `signal()`s.
- Summaries are `computed()` against those signals — recompute is automatic on any entry change
  and is bounded to the work of a fold over ~80 entries.
- Persisted to `sessionStorage` keyed by `projectId` so refresh restores the in-memory cache; the
  store re-validates against the backend on resume.

## Usability / Accessibility

### NFR-U2-8.1 Accessibility — Unit 2 frontend
- Same WCAG 2.1 AA-aligned posture as Unit 1.
- Tree controls expose `aria-expanded` / `aria-controls`.
- Disabled view-tabs use `aria-disabled="true"` and an explanatory `mat-tooltip`.
- Point cells render with `role="spinbutton"` semantics via numeric `<input>`.
- Out-of-range warnings tied to inputs via `aria-describedby`.

## Compliance & Privacy

- No PII in this unit's records (project IDs and point values only).
- The seeded demo project's GBCI ID is `RES-DEMO-001`.

## Open Items (deferred)
- Verification field definitions and submittal slot definitions per credit (Unit 4).
- Reviewer write path for `awardedPoints` and the official "award all verified" action (Unit 5).
- Optimistic-lock enforcement on `version` (potentially Unit 5 or later).
- Tier-aware UI for credits with `CreditPointValue` rows (a basic dropdown is sufficient in U2;
  richer guidance comes with workbook context in U4).
