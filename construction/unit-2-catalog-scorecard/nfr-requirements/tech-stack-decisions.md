# Unit 2 — Tech Stack Decisions (delta vs Unit 1)

No new backend or frontend libraries are required for Unit 2. Everything reuses the foundation set
by Unit 1.

## Backend

| Concern | Choice | Notes |
|---|---|---|
| Catalog seed format | **Hand-curated JSON** at `scripts/seed/leed-v41-sf-catalog.json` (Q1=C) | Authored from `docs/REPO_LEED_v4.1_Residential_Single_Family_Rating_System_1.2020.pdf`. Loaded by `CatalogSeeder` `OnModuleInit`. |
| Catalog cache | **In-process map** in `CatalogService` (Q14=A) | Invalidated when seeder runs. |
| Scorecard math | **Pure module** at `src/scorecard/calculator/` (Q12=A) | No NestJS or TypeORM imports. |
| Concurrency | **Last-write-wins**; `version: integer` column for forward-compat (Q13=A) | Not enforced this build; documented in OpenAPI. |
| Validation override | **Flag-don't-reject** for out-of-credit-range (Q10=A) | Warnings returned in response. |
| State-lock hook | `StateLockService.assertWritable(projectId)` no-op (Unit 5 will replace with real check) | Wired now to keep call sites stable. |

## Frontend (Angular 20.2)

| Concern | Choice | Notes |
|---|---|---|
| Scorecard tree | **Custom recursive components** (`category-row` → `credit-row`) | Angular Material's `mat-tree` is overkill for two fixed levels and complicates point-cell layout. We use plain components for clearer control. |
| Tabs | **`mat-tab-group`** for the view-tabs (Q7=A) | `All` is the only enabled tab in U2; the others are disabled with `mat-tooltip`. |
| Inline edit | **Custom `point-cell` component** wrapping `<input type="number">` | Lighter than `mat-form-field` for a dense grid; we keep Material focus + spacing tokens. |
| State store | **Signal-based store** (Q11=A) | `features/scorecard/scorecard.store.ts`; `sessionStorage`-persisted per project. |
| Dialogs | **`mat-dialog`** for the Attempted-off confirmation (Q5=A) | Standard Material dialog pattern. |

## PBT Framework
- Selected: `fast-check`. Already installed as a devDependency in both backend and frontend
  (Unit 1). PBT-09 remains COMPLIANT.
- Test cases for the calculator are described in `business-logic-model.md` BL-7. Tests remain
  **skipped** per the documented Unit 1 deviation.

## PBT Compliance Verification (this stage)

- [x] PBT framework selected and documented (fast-check) — backend and frontend.
- [x] Framework supports custom generators, shrinking, seed-based reproducibility.
- [x] Framework included as project dependency (already added in Unit 1).

PBT-09 — COMPLIANT. PBT-01 properties identified in Functional Design (BL-7). PBT-02..08, PBT-10
are deferred per documented deviation.
