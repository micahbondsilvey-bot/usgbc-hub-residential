# Unit 2 — NFR Design Patterns

How Unit 2's NFRs translate into concrete patterns. Decisions reflected:
Q12=A pure calculator placement; Q13=A last-write-wins + forward-compatible `version`; Q14=A
in-process catalog cache.

## Performance Patterns

### P-1 In-process catalog cache (Q14=A)
- **Pattern**: `CatalogService` keeps an immutable snapshot of the rating system (`RatingSystemDto`
  with nested categories, credits, tiers) in memory.
- **Lifecycle**: warmed lazily on first read; explicit invalidation when `CatalogSeeder` re-runs
  (`OnModuleInit` and on-demand admin-only endpoint).
- **Concurrency**: a single `Promise<RatingSystemDto>` shields concurrent first-readers from a
  thundering herd.
- **Why**: ~80 credits × small object size fits trivially in memory; eliminates ORM round-trips
  on every page load.

### P-2 Pure calculator module (Q12=A)
- **Pattern**: `src/scorecard/calculator/scorecard-summary.calculator.ts` exports stateless
  functions. No NestJS decorators, no DB access. Inputs and outputs are POJOs; the same shapes
  appear in `core/api/dto.ts`.
- **Why**: Trivial to test (PBT-ready when tests are re-enabled), trivial to reason about, and
  reusable on the frontend (`features/scorecard/scorecard-summary.calc.ts` mirrors it).

### P-3 Frontend Signal graphs
- **Pattern**: `entries: signal<Map<creditId, ScorecardEntryDto>>` is the source of truth on the
  FE; everything user-visible (`view`, `summary`, `warnings`) is `computed()` from it.
- **Why**: Recompute is bounded to the work of a fold over ~80 entries — well under one frame
  even on mid-range mobile.

## Resilience / Concurrency Patterns

### R-1 Last-write-wins (Q13=A)
- **Pattern**: Scorecard writes are per-cell; the latest write prevails. The `version` integer
  column on `ScorecardEntry` increments on every persisted change but is not validated against a
  client-supplied value this build.
- **Documented**: OpenAPI marks `version` as informational; clients should not yet branch on it.
- **Why**: A demo / single-team build doesn't need the rejection round-trips of optimistic locks;
  shipping the column now keeps a forward path open.

### R-2 Optimistic UI with rollback
- **Pattern (frontend)**: `ScorecardStore.setPoint(...)` updates the local Signal first, then
  awaits the backend response; on error the local update is reverted and an `errorMessage` is
  set. Same approach for `attempt`/`unattempt`.
- **Why**: Sub-frame latency target (NFR-U2-2.1) requires we don't wait for the network on every
  keystroke.

### R-3 Catalog seed fail-fast
- The seeder validates every invariant in `business-rules.md` BR-C3 / BR-C4 before persisting.
  Any violation aborts startup with a clear error — better than serving an inconsistent catalog.

## Security Patterns

### S-1 Authorization composition with Unit 1
- All scorecard routes carry `:projectId` and use Unit 1's `ProjectRolesGuard` with the
  appropriate `@ProjectRoles(...)` metadata. Admin always passes.
- Per-column write rules (BR-S2) are enforced at the service layer because the guard's allow-set
  is not column-aware. Service-side checks reuse the actor `globalRole` and the resolved
  project role.

### S-2 Input validation
- DTOs validated by the global `ValidationPipe` (whitelist + forbidNonWhitelisted) — point columns
  must be non-negative integers; `attempted` must be boolean; `selectedPointValueId` must be a
  UUID when present.
- Out-of-credit-range integers are accepted (BR-S6) — the override is a domain rule, not a
  schema-level concession.

## Observability Patterns

### O-1 Audit explicit-record on attempted flips
- Per BR-S10, an `AuditService.record(...)` row is written when `attempted` flips so the
  per-cell history is queryable beyond the entity-level audit columns.
- Numeric edits (`attemptedPoints/verifiedPoints/awardedPoints`) rely on the `updatedAt/updatedBy`
  columns plus the `version` integer; if richer history is needed later, a single hook in
  `ScorecardService.setPoints` adds it without touching call sites.

### O-2 Logging
- Catalog seeding logs counts at `info` level once; subsequent reads are silent (cache hits).
- Scorecard writes log structured fields: `event`, `actorUserId`, `projectId`, `creditSlug`,
  `column`, `warningCount`, `version`. No values that could leak business-sensitive data.

## Quality Patterns

### Q-1 Pure-module-first
- Anything that's pure logic (BR-S6 warning detection, BR-S8 summary, certification-level
  derivation, tier validation) lives in `src/scorecard/calculator/` so it can be PBT-tested
  later without touching DB or HTTP.

### Q-2 Strict typing across the seam
- The shared shapes (`RatingSystemDto`, `CreditDto`, `ScorecardEntryDto`, `ScorecardSummary`,
  `Warning`) live in the backend's `src/shared/dto/` (or equivalent) and are mirrored type-by-type
  in the frontend's `core/api/dto.ts`. The FE calculator is the only piece that is hand-mirrored
  and is annotated with a `// MIRROR OF backend ScorecardSummaryCalculator — keep in sync`
  comment block.

## PBT Compliance Summary (this stage)

- **PBT-01**: COMPLIANT — calculator properties identified in `business-logic-model.md` BL-7.
- **PBT-09**: COMPLIANT — `fast-check` declared in deps.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per Unit 1
  precedent. Re-enable by adding `*.pbt.spec.ts` files invoking the pure calculator with
  generators; no code-side rework needed.
