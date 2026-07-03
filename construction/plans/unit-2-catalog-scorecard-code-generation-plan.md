# Code Generation Plan — Unit 2: LEED Catalog & Scorecard

**Source of truth** for U2 Code Generation. Tests are skipped consistent with the documented Unit 1
PBT deviation; the steps are present below as `~~Skipped~~` for traceability.

---

## Unit Context

- **Workspace root**: `/Users/hbayyapu/usgbc-hub-residential`
- **Backend dir**: `usgbc-hub-residential-be/`
- **Frontend dir**: `usgbc-hub-residential-fe/`
- **Doc summary**: `aidlc-docs/construction/unit-2-catalog-scorecard/code/`

### Stories
- US-3.1 Seed real LEED v4.1 SF credit catalog
- US-3.2 View scorecard with categories and credits
- US-3.3 Toggle attempted credits & enter points (override-friendly)
- US-3.4 Live summary bar with certification level
- US-3.5 Scorecard view-tab filtering (only "All" enabled in U2)
- US-3.6 Editable project-info panel (read-only in U2; Unit 3 enables edit)

### Dependencies
- Unit 1 (auth, RBAC, audit, request context, throttler).

### Database entities owned by this unit
- `rating_system`, `credit_category`, `credit`, `credit_point_value`, `scorecard_entry`.
- A placeholder demo project row (`projects.id` will be replaced by Unit 3's `Project` entity).

---

## Generation Steps

### Backend — Catalog

- [x] **Step 1** Create `src/catalog/rating-system.entity.ts` (incl. `certificationLevels: jsonb`).
- [x] **Step 2** Create `src/catalog/credit-category.entity.ts`.
- [x] **Step 3** Create `src/catalog/credit.entity.ts` (rich fields: `intent`, `requirementsSummary`, `referenceGuideUrl`, `tags`).
- [x] **Step 4** Create `src/catalog/credit-point-value.entity.ts`.
- [x] **Step 5** Create `src/catalog/dto/{rating-system.dto.ts, credit.dto.ts}` (response shapes shared via `core/api/dto.ts` on the FE).
- [x] **Step 6** Create `src/catalog/catalog.service.ts` (in-process cache + invalidation).
- [x] **Step 7** Create `src/catalog/catalog.controller.ts` (`GET /api/v1/catalog/rating-systems`, `GET /api/v1/catalog/rating-systems/:idOrSlug`).
- [x] **Step 8** Create `src/catalog/catalog.seeder.ts` (`OnModuleInit`, idempotent upserts, BR-C2..C4 invariants validated, `AuditStampHelper` system-stamping).
- [x] **Step 9** Create `src/catalog/catalog.module.ts`.
- [x] **Step 10** Author `scripts/seed/leed-v41-sf-catalog.json` from the LEED v4.1 SF rating system PDF (real categories, credits, prereqs, point values; certification levels Certified 40-49 / Silver 50-59 / Gold 60-79 / Platinum 80+).

### Backend — Scorecard

- [x] **Step 11** Create `src/scorecard/scorecard-entry.entity.ts` (with `version: integer`).
- [x] **Step 12** Create `src/scorecard/calculator/scorecard-summary.calculator.ts` (pure module, no NestJS imports).
- [x] **Step 13** Create `src/scorecard/calculator/scorecard-warnings.ts` (pure helpers: out-of-range detection per BR-S6).
- [x] **Step 14** Create `src/scorecard/dto/{scorecard.dto.ts, scorecard-summary.dto.ts, set-points.dto.ts, toggle-attempted.dto.ts, warning.dto.ts}`.
- [x] **Step 15** Create `src/scorecard/state-lock.service.ts` (stub: `assertWritable(projectId)` no-op; Unit 5 will replace).
- [x] **Step 16** Create `src/scorecard/scorecard.service.ts` implementing BL-3..BL-6 with per-column write rules per BR-S2 and explicit `AuditService.record` on attempted flips.
- [x] **Step 17** Create `src/scorecard/scorecard.controller.ts` (`GET /scorecard`, `GET /summary`, `PUT /:creditId`, `POST /:creditId/un-attempt`).
- [x] **Step 18** Create `src/scorecard/demo.seeder.ts` (`OnModuleInit`, after CatalogSeeder; placeholder demo project row + memberships reconciliation + scorecard init + curated Silver-band edits; idempotent on `createdBy/updatedBy = null` rows only).
- [x] **Step 19** Create `src/scorecard/scorecard.module.ts`.

### Backend — Wiring

- [x] **Step 20** Modify `src/app.module.ts`: import `CatalogModule` and `ScorecardModule`; register the new entities under TypeORM.

### Backend — Tests — SKIPPED PER DOCUMENTED DEVIATION
- [ ] ~~Step 21~~ **Skipped** — PBT for `ScorecardSummaryCalculator` (7 properties from BL-7).
- [ ] ~~Step 22~~ **Skipped** — example tests for service paths (toggle, set-points, summary).

### Frontend — Scorecard feature

- [x] **Step 23** Extend `src/app/core/api/dto.ts` with U2 shapes: `RatingSystemDto`, `CreditCategoryDto`, `CreditDto`, `CreditPointValueDto`, `ScorecardEntryDto`, `ScorecardSummaryDto`, `WarningDto`, `CertificationLevel`, `ScorecardDto`.
- [x] **Step 24** Extend `src/app/core/api/api-client.ts` with the U2 endpoints (`getCatalog`, `listRatingSystems`, `getScorecard`, `getSummary`, `toggleAttempted`, `unattempt`, `setPoints`).
- [x] **Step 25** Create `features/scorecard/scorecard-summary.calc.ts` (mirror of backend pure calculator; sync-marker comment).
- [x] **Step 26** Create `features/scorecard/scorecard.store.ts` (Signals: catalog, entries, meRole, pendingWrites; computed view + summary + warnings; `sessionStorage` persistence keyed by projectId).
- [ ] ~~**Step 27** Create `features/scorecard/api/scorecard-api.client.ts`~~ — **Folded into the core ApiClient (Step 24); a separate facade adds no value at this size.**
- [x] **Step 28** Create `features/scorecard/components/scorecard-summary-bar/scorecard-summary-bar.component.ts`.
- [x] **Step 29** Create `features/scorecard/components/scorecard-view-tabs/scorecard-view-tabs.component.ts` (only "All" enabled; others disabled-with-tooltip).
- [x] **Step 30** Create `features/scorecard/components/project-info-panel/project-info-panel.component.ts` (read-only in U2; placeholder fields).
- [x] **Step 31** Create `features/scorecard/components/category-row/category-row.component.ts`.
- [x] **Step 32** Create `features/scorecard/components/credit-row/credit-row.component.ts`.
- [x] **Step 33** Create `features/scorecard/components/point-cell/point-cell.component.ts` (inline integer editor with warning surface).
- [x] **Step 34** Create `features/scorecard/components/attempted-toggle/attempted-toggle.component.ts` (locked-on for prereqs; confirmation dialog on un-attempt).
- [x] **Step 35** Create `features/scorecard/components/confirm-clear-dialog/confirm-clear-dialog.component.ts` (MatDialog).
- [x] **Step 36** Create `features/scorecard/scorecard-page/scorecard-page.component.ts` (top-level layout).
- [x] **Step 37** Create `features/scorecard/scorecard.routes.ts`; mount under `/projects/:projectId/scorecard` with `authGuard` + `projectRoleGuard` (`allowedProjectRoles: ['*']`).
  > Note: rather than a per-feature routes file, the route is registered directly in `app.routes.ts` (lazy-loaded) to match the existing route style. `projectRoleGuard` is wired and ready; for the demo we use only `authGuard` since the demo project's `:projectId` may not yet have memberships in some environments.
- [x] **Step 38** Update `src/app/app.routes.ts` to lazy-load the scorecard feature; add a header/profile link to "Demo project scorecard".

### Frontend — Tests — SKIPPED
- [ ] ~~Step 39~~ **Skipped** — FE PBT mirror of calculator + example tests for components.

### Documentation

- [x] **Step 40** Create `aidlc-docs/construction/unit-2-catalog-scorecard/code/README.md` (file inventory, run instructions, endpoints, story coverage, PBT deviation note).
- [x] **Step 41** Update `usgbc-hub-residential-be/README.md` with U2 routes and seeded demo project notes.
- [x] **Step 42** Update `usgbc-hub-residential-fe/README.md` with the new scorecard route.

### Validation

- [x] **Step 43** Diagnostics clean across all created/modified files.
- [x] **Step 44** No duplicate file artifacts (`*_modified.ts`, `*_new.ts`).
- [x] **Step 45** Mark all U2 stories `[x]` in the story map.
- [x] **Step 46** Smoke test: backend boots, seeder logs catalog count + Silver-band demo summary, FE scorecard page renders the seeded demo project's scorecard with the live summary bar showing Silver.

---

## Story Coverage

| Story | Steps |
|---|---|
| US-3.1 | 1–10, 18 |
| US-3.2 | 5, 7, 16, 17, 23, 24, 28, 31, 32, 36, 37 |
| US-3.3 | 14, 16, 17, 33, 34, 35 |
| US-3.4 | 12, 13, 16, 17, 25, 26, 28 |
| US-3.5 | 29 |
| US-3.6 | 30 |

## Total
**46 numbered steps** (4 marked skipped consistent with the U1 PBT deviation).

## PBT Compliance for this stage
- **PBT-01**: COMPLIANT — properties documented in `business-logic-model.md` BL-7.
- **PBT-09**: COMPLIANT — `fast-check` already in deps.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DEVIATION) — tests skipped per Unit 1 precedent. The pure
  calculator at `src/scorecard/calculator/` is built so tests can be added later without code
  rework.
