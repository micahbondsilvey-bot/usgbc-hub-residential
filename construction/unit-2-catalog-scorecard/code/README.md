# Unit 2 — Code Summary

What was generated, where, and how to run it.

## Application code

### Backend (`usgbc-hub-residential-be/`)

**Created (Phase A, Steps 1–20)**
- Catalog: `src/catalog/{rating-system,credit-category,credit,credit-point-value}.entity.ts`,
  `src/catalog/dto/{rating-system,credit}.dto.ts`,
  `src/catalog/{catalog.service.ts, catalog.controller.ts, catalog.seeder.ts, catalog.module.ts}`.
- Catalog data: `scripts/seed/leed-v41-sf-catalog.json` — hand-curated subset of LEED v4.1 SF
  (8 categories, 31 credits, 8 prereqs; `totalPointsAvailable=98`; canonical thresholds).
- Scorecard: `src/scorecard/scorecard-entry.entity.ts`,
  `src/scorecard/calculator/{scorecard-summary.calculator, scorecard-warnings}.ts`,
  `src/scorecard/dto/{scorecard, scorecard-summary, set-points, toggle-attempted, warning}.dto.ts`,
  `src/scorecard/{state-lock.service, scorecard.service, scorecard.controller,
  demo.seeder, scorecard.module}.ts`.

**Modified**
- `src/app.module.ts` — registered `CatalogModule`, `ScorecardModule`, and the new entities.

### Frontend (`usgbc-hub-residential-fe/`)

**Created (Phase B, Steps 23–38)**
- `src/app/features/scorecard/scorecard-summary.calc.ts` — pure mirror of the backend calculator.
- `src/app/features/scorecard/scorecard.store.ts` — Signal-based feature store with
  `sessionStorage` persistence per project.
- `src/app/features/scorecard/scorecard-page/scorecard-page.component.ts` — top-level page.
- `src/app/features/scorecard/components/`
  - `confirm-clear-dialog/confirm-clear-dialog.component.ts`
  - `attempted-toggle/attempted-toggle.component.ts`
  - `point-cell/point-cell.component.ts` (override-friendly: out-of-range values save with a warning style)
  - `scorecard-summary-bar/scorecard-summary-bar.component.ts`
  - `scorecard-view-tabs/scorecard-view-tabs.component.ts` (only "All" enabled in U2)
  - `project-info-panel/project-info-panel.component.ts` (read-only in U2)
  - `category-row/category-row.component.ts`
  - `credit-row/credit-row.component.ts`

**Modified**
- `src/app/core/api/dto.ts` — extended with U2 shapes (rating system, scorecard, summary, warning).
- `src/app/core/api/api-client.ts` — added catalog + scorecard endpoints.
- `src/app/app.routes.ts` — registered the lazy-loaded `/projects/:projectId/scorecard` route.
- `src/app/app.component.ts` — added a "Demo scorecard" link in the header.

## How to run locally

```bash
# Backend (Node 20.13.x; Postgres + Redis via Docker Compose)
cd usgbc-hub-residential-be && npm install && npm run db:up && npm run start:dev

# Frontend (Node 20.19.x via .nvmrc)
cd usgbc-hub-residential-fe
nvm use   # picks up .nvmrc → 20.19.0
npm install
npm start
```

Browse to `http://localhost:4200/`, sign in with `admin@residential.test` / `Admin123!`, and click
**Demo scorecard** in the header. The seeded demo project shows a Silver-band scorecard.

### Endpoints (Unit 2)

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/catalog/rating-systems` | bearer |
| GET | `/api/v1/catalog/rating-systems/:idOrSlug` | bearer |
| GET | `/api/v1/projects/:projectId/scorecard` | bearer + member/Admin |
| GET | `/api/v1/projects/:projectId/scorecard/summary` | bearer + member/Admin |
| PUT | `/api/v1/projects/:projectId/scorecard/:creditId` | bearer + role per BR-S2 |
| POST | `/api/v1/projects/:projectId/scorecard/:creditId/un-attempt` | bearer + PT/GR/Admin |

## Stories satisfied
US-3.1 (catalog seed), US-3.2 (scorecard view), US-3.3 (override-friendly toggles + points),
US-3.4 (live summary bar + certification level), US-3.5 (view tabs — All enabled, others disabled
with tooltip), US-3.6 (read-only project-info panel; editing lands in Unit 3).

## PBT compliance summary (this build)

| Rule | Status |
|---|---|
| PBT-01 Property identification | COMPLIANT (calculator properties documented in `business-logic-model.md` BL-7) |
| PBT-09 Framework selection | COMPLIANT (`fast-check` in deps cross-stack) |
| PBT-02..08, PBT-10 | DOCUMENTED DEVIATION — tests skipped per Unit 1 precedent |

## Out of scope this unit
- Reviewer write path for `awardedPoints` (Unit 5).
- Verification field / submittal slot definitions per credit (Unit 4 — parsed from the worksheet).
- Tier selection UI for credits with `CreditPointValue` rows (the schema supports it; UI lands as needed).
- Backend / frontend tests (skipped per documented PBT deviation).
