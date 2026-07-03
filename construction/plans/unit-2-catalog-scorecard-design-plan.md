# Unit 2 — Catalog & Scorecard — Batched Design Plan

**Cadence**: Batched (FD + NFR Requirements + NFR Design questions consolidated for one approval gate).

**Unit goal**: Real LEED v4.1 SF rating-system catalog (categories, credits, prerequisites, point
values) and per-project scorecard with toggles, point entry, and live summary including derived
certification level.

**Stories in unit**: US-3.1, US-3.2, US-3.3, US-3.4, US-3.5, US-3.6.

**PBT-01 obligation** (carry-over from Unit 1): identify testable properties for the scorecard
calculator and certification-level derivation; properties are documented in design and (per the
documented deviation) tests remain optional this build.

**Already pinned globally** (no need to re-decide):
- TypeScript / NestJS / Angular 20.2 / PostgreSQL / local-only Docker Compose.
- Hybrid RBAC + per-project membership (Unit 1).
- AuditBase mixin + AuditService + AuditStampInterceptor + AuditStampHelper.
- Real LEED v4.1 SF data (Q6=A) — relational catalog (Application Design Q3=A).
- API conventions: `/api/v1` + Swagger.
- Demo posture; pre-seeded data.

This plan asks the **Unit-2-specific** decisions across Functional Design, NFR Requirements, and
NFR Design.

---

## Functional Design Questions

### Question 1 — Catalog seed source
The real LEED v4.1 SF catalog must be modeled. The provided sources include
`docs/REPO_LEED_v4.1_Residential_Single_Family_Rating_System_1.2020.pdf` (the rating system PDF)
and `docs/LEED_v4.1_SF_Verification_Submittals_Worksheet.xlsx` (the verification/submittal worksheet).

A) Hand-curate a JSON seed file (`scripts/seed/leed-v41-sf-catalog.json`) authored from the rating system PDF; load via a `CatalogSeeder` on startup. Recommended — fastest path, deterministic, easy to inspect.

B) Parse the verification submittal worksheet (.xlsx) at startup and reconstruct categories/credits from it.

C) Both — hand-curated JSON for the catalog structure, with the worksheet parsed later (Unit 4) to produce verification/submittal slot definitions.

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 2 — Catalog schema shape (per-credit data)
Each credit needs: id (slug), category, title, optional/prerequisite flag, point value (or range
when the credit awards 1..N points), and a brief description. Should we capture more in this build?

A) Minimal: id, slug, category, title, isPrerequisite, points (number for fixed; min/max for range), description. Seed verification/submittal-field definitions in Unit 4. Recommended.

B) Rich: also include per-credit referenceGuideUrl, intent text, and tags (mobility/water/energy/etc.) now.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 3 — Certification-level thresholds
Where do the Certified / Silver / Gold / Platinum thresholds live?

A) Per rating-system row in the database (`rating_system.certificationLevels = JSON`) — values seeded from the LEED v4.1 SF rating system. Recommended — different rating systems will have different thresholds when more are added.

B) Hardcoded constants in code.

C) Per-project override (each project carries its own thresholds copied at registration).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Scorecard entry semantics
The Scorecard has Attempted / Verified / Awarded columns per credit. How should they relate
operationally?

A) Three independent integer fields per `(projectId, creditId)` row. Out-of-range values are flagged but accepted (per requirements 3.3.3 override). Recommended.

B) Single field with state machine transitions per phase.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — "Attempted toggle" semantics
US-3.3 says optional credits can be toggled "Attempted"; prerequisites are always-on (no separate
lock icon). What happens to entered points when a user un-attempts a credit?

A) Soft-clear: zero out Attempted/Verified/Awarded but keep the row (so re-attempting restores nothing). Confirm prompt before clearing. Recommended.

B) Hard-delete the scorecard entry; re-toggling creates a fresh row.

C) Preserve values but mark the row inactive; re-toggling restores them.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Scorecard summary computation locations
Per NFR-3.1, the **frontend** computes the live summary for instant feedback while the **backend**
is authoritative for final totals/level. The unit needs a single source of truth for the math.

A) Pure calculator module (`ScorecardSummaryCalculator`) lives in the backend; the frontend reimplements the same math against the same inputs (kept consistent via shared TypeScript types in a `core/api/dto.ts`-like file). Documented in code comments. Recommended for U2 (no shared lib infra yet).

B) Extract a shared TypeScript package consumed by both projects.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Scorecard view-tabs
US-3.5 requires filter tabs: All / Field Verification / Submittals / Verification Notes. In Unit 2
(no workbook yet), how should these behave?

A) The tabs are present; All shows the scorecard tree; the other three tabs are placeholders (disabled with tooltip "Available after Unit 4 — Workbook"). Recommended.

B) The tabs are wired to the backend now and return empty lists until Unit 4 ships.

C) Defer the tabs entirely; ship Unit 2's scorecard with no view filtering.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Demo project + scorecard for end-to-end demo
Unit 1 seeds four user accounts but no demo project (US-2.x lands in Unit 3). Should Unit 2 also
seed a demo project + scorecard so the UI has something to render before Unit 3 lands?

A) Yes — Unit 2's `CatalogSeeder` also seeds a demo project (UUID + GBCI ID `RES-DEMO-001`) and reconciles the Unit-1 demo memberships (team@/rater@/reviewer@). Unit 3 will then own the project entity proper. Recommended.

B) No — Unit 2 only seeds the catalog; the scorecard UI shows an "no projects yet" empty state until Unit 3.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## NFR Requirements Questions

### Question 9 — Performance targets (local demo)
For the new endpoints/UI in this unit:

A) `GET /catalog/rating-systems/:id` p95 ≤ 100 ms (cacheable in memory once seeded); `GET /projects/:projectId/scorecard` p95 ≤ 200 ms; `PUT scorecard entries` p95 ≤ 150 ms; FE summary recompute < 16 ms (one frame). Recommended.

B) Stricter (numbers below half).

C) Best-effort.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 10 — Scorecard input validation
Per requirements 3.3.3, invalid point entries are flagged but overridable.

A) Backend accepts and persists all integers within `[0, MAX_INT_REASONABLE]`; out-of-credit-range values come back with a `validation.warning` field on the response (advisory). Both frontend live-summary and backend-authoritative summary include the warnings list. Recommended.

B) Backend rejects values outside `[0, ratingSystemMaxPoints]` even if individual credits are out of range.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 11 — Frontend state for scorecard
The scorecard UI needs to manage tree expansion + per-credit edits + live summary.

A) Signal-based feature store (`features/scorecard/scorecard.store.ts`) with `signal()`s for the entries map and `computed()`s for category and overall totals. Persisted to `sessionStorage` keyed by project so a refresh keeps your place. Recommended.

B) Pull data on every navigation, no client-side store.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## NFR Design Questions

### Question 12 — Pure calculator module placement
The scorecard math is pure. Where should it live in the backend?

A) `src/scorecard/calculator/` with no NestJS or TypeORM imports — easy to invoke from services and (later) tests. Recommended.

B) Inside `ScorecardService` as private methods.

X) Other (please describe after [Answer]: tag below)

[Answer]:  A

### Question 13 — Scorecard write concurrency
Two clients (or one client retrying) might update the same `(projectId, creditId)` simultaneously.

A) Last-write-wins on a per-cell update (documented in API). Per-row `version` integer column for optional optimistic-locking later; not enforced this build. Recommended.

B) Optimistic concurrency now: send `version` on every update; backend rejects on mismatch.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 14 — Catalog caching
The catalog is read-heavy and mostly static.

A) In-process `CatalogService` caches the catalog in memory after first load; cache invalidates when the seeder runs. Recommended for local demo.

B) Always read from DB; rely on Postgres buffers.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (Part 2 — runs after answers approved)

### Functional Design artifacts

- [x] Generate `aidlc-docs/construction/unit-2-catalog-scorecard/functional-design/domain-entities.md`
  (RatingSystem, CreditCategory, Credit, CreditPointValue, ScorecardEntry).
- [x] Generate `business-rules.md` (Attempted/Verified/Awarded semantics, override behavior on
  out-of-range, Attempted toggle off behavior, certification-level derivation, prereq locking).
- [x] Generate `business-logic-model.md` (load catalog, render scorecard, set attempted, set points,
  compute summary, compute certification level — each with PBT-01 properties).
- [x] Generate `frontend-components.md` (scorecard tree, point entry inline editor, live summary
  bar, view-tab filtering, project-info panel).

### NFR Requirements artifacts

- [x] Generate `nfr-requirements.md` for U2 (perf, validation semantics, FE state strategy, audit
  application to scorecard rows).
- [x] Generate `tech-stack-decisions.md` delta (no new libraries expected; document Material tree +
  table choices for the FE).

### NFR Design artifacts

- [x] Generate `nfr-design-patterns.md` (calculator-as-pure-module, last-write-wins +
  forward-compatible `version` column, in-process catalog cache, FE summary recompute via Signals
  computed graphs).
- [x] Generate `logical-components.md` (`CatalogModule`, `ScorecardModule`, FE
  `ScorecardStore`/components, view-tabs placeholder strategy).
