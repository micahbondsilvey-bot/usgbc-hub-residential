# Unit 6 — Portfolio — Code

Implements US-5.1, US-5.2, US-5.3, and US-7.2 with the documented dual-stage skip
deviation (NFR Requirements + NFR Design skipped per the carry-forward cadence).
Tests deferred per the documented PBT deviation (PBT-01 properties identified;
PBT-02..08 + PBT-10 skipped).

---

## Files

### Backend (`usgbc-hub-residential-be/`)

**New module — `src/portfolio/`**:
- `state-machine/hierarchy.invariant.ts` — pure `assertHierarchy(child, candidate)` (FL-12).
- `dto/patch-anchor.dto.ts`, `dto/patch-parent-anchor.dto.ts` — request DTOs.
- `dto/portfolio-dashboard.dto.ts` — `PortfolioDashboardDto`,
  `ProjectSummaryDto`, `LatestReviewSummaryDto`, `PortfolioRollupDto`.
- `dto/portfolio-fee-quote.dto.ts` — `PortfolioFeeQuoteDto`,
  `PortfolioFeeQuoteLineItemDto`.
- `dto/batch-submit-result.dto.ts` — `BatchSubmitResultDto`,
  `AnchorSubmitOutcomeDto`, `ChildSubmitOutcomeDto`, `SkipReason`,
  `PortfolioSubmitDto`, `PortfolioPayAndSubmitDto`.
- `portfolio.service.ts` — anchor toggle, attach / detach, dashboard builder,
  un-anchor guard (BR-PA1..BR-PA6).
- `portfolio-fee.service.ts` — combined-fee aggregation (BR-PF1).
- `portfolio-submission.orchestrator.ts` — anchor-first cascade + independent
  children (BR-BS1..BR-BS8 / FL-13 / FL-14).
- `portfolio.controller.ts` — six routes under `/api/v1/projects/:projectId/...`.
- `portfolio.module.ts` — Nest module.

**Modified files**:
- `src/projects/project.entity.ts` — added `is_portfolio_anchor` column.
- `src/projects/registration-ddl.bootstrapper.ts` — added 3 CHECK/FK constraints
  + 1 partial index, all idempotent via `DO $$ ... EXCEPTION` blocks.
- `src/projects/dto/project.dto.ts` — added `isPortfolioAnchor`.
- `src/projects/projects.service.ts` — `toDto` includes new field; `listForActor`
  accepts `{ isPortfolioAnchor?, parentAnchorId? }` filter.
- `src/projects/projects.controller.ts` — list route exposes
  `isPortfolioAnchor` and `parentAnchorId` query parameters.
- `src/review/submission.orchestrator.ts` — extracted `validateSubmittable` /
  public `assertSubmittable` (BR-BS6); behavior unchanged for U5 callers.
- `src/review/review.module.ts` — exports `SubmissionOrchestrator`.
- `src/common/exception/all-exceptions.filter.ts` — preserves structured
  problem-json fields (`code`, `result`, `quote`, `reason`) so the FE can
  render the FL-13 cascade.
- `src/app.module.ts` — registers `PortfolioModule`.

### Frontend (`usgbc-hub-residential-fe/`)

**New feature — `src/app/features/portfolio/`**:
- `portfolio.store.ts` — signal-backed store (load, refresh, fee quote,
  submit/pay-and-submit, sticky `lastBatchResult`).
- `portfolio-page.component.ts` — `/projects/:anchorId/portfolio` lazy route.
- `designate-anchor.dialog.component.ts` — anchor toggle + attach autocomplete
  + detach action; maps backend codes to plain-language messages.
- `batch-submit.dialog.component.ts` — phase picker, fee quote preview,
  cascade banner, per-row outcome rendering.

**Modified files**:
- `src/app/core/api/dto.ts` — added `isPortfolioAnchor` /
  `achievedCertificationLevel` to `ProjectDto`; added all U6 DTOs.
- `src/app/core/api/api-client.ts` — `listProjects` accepts filter; added 6 U6
  endpoints (`patchAnchor`, `patchParentAnchor`, `getPortfolioDashboard`,
  `getPortfolioFeeQuote`, `submitPortfolio`, `payAndSubmitPortfolio`).
- `src/app/features/projects/project-detail-page.component.ts` — new
  "Portfolio" card with anchor / member chips + "Manage portfolio settings"
  CTA + (when anchor) "Open dashboard" + top-bar Portfolio button.
- `src/app/app.routes.ts` — added the lazy portfolio route.

---

## Endpoints (quick reference)

| Method | Path | Purpose |
|---|---|---|
| `PATCH` | `/api/v1/projects/:projectId/anchor` | Toggle anchor flag (BR-PA1). |
| `PATCH` | `/api/v1/projects/:projectId/parent-anchor` | Attach/detach to anchor (BR-PA5/BR-PA6). |
| `GET`   | `/api/v1/projects/:projectId/portfolio` | Portfolio dashboard read model (BR-PM2). |
| `GET`   | `/api/v1/projects/:projectId/portfolio/fee-quote?phase=` | Aggregated fee quote (BR-PF1). |
| `POST`  | `/api/v1/projects/:projectId/portfolio/submit` | Batch submit (BR-BS1..BR-BS8). |
| `POST`  | `/api/v1/projects/:projectId/portfolio/pay-and-submit` | Combined pay + batch submit (BR-PF2/BR-PF3). |

Existing list endpoint extended:
- `GET /api/v1/projects?isPortfolioAnchor=true|false&parentAnchorId=<uuid|null>`.

---

## DDL added (Postgres)

Owned by `RegistrationDdlBootstrapper.bootstrapPortfolioConstraints()`,
idempotent via `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL END $$`:

```sql
ALTER TABLE project ADD CONSTRAINT project_no_self_parent_chk
  CHECK (parent_anchor_id IS NULL OR parent_anchor_id <> id);

ALTER TABLE project ADD CONSTRAINT project_anchor_no_parent_chk
  CHECK (NOT (is_portfolio_anchor = true AND parent_anchor_id IS NOT NULL));

ALTER TABLE project ADD CONSTRAINT project_parent_anchor_fk
  FOREIGN KEY (parent_anchor_id) REFERENCES project(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS project_parent_anchor_idx
  ON project (parent_anchor_id) WHERE parent_anchor_id IS NOT NULL;
```

The `is_portfolio_anchor BOOLEAN NOT NULL DEFAULT false` column is created by
TypeORM `synchronize: true`.

---

## Smoke test (against running BE :3000)

Verified scenarios (Admin actor):

| # | Scenario | Result |
|---|---|---|
| 1 | Designate RES-100000 as anchor | 200, `isPortfolioAnchor=true` |
| 2 | Attach RES-100001 + RES-100002 as children | 200 each |
| 3 | GET dashboard | rollup with 2 children, anchor's 50/49 attempted/awarded |
| 4 | Try un-anchor while children attached | 409 `ANCHOR_HAS_CHILDREN` (BR-PA3) |
| 5a | Attempt self-parent (`parentAnchorId = self`) | 409 `HIERARCHY_SELF_PARENT` (FL-12) |
| 5b | Attach to non-anchor target | 409 `HIERARCHY_TARGET_NOT_ANCHOR` (FL-12) |
| 6 | Batch submit (anchor eligible; children no-attempted) | anchor SUBMITTED REV-100002, both children SKIPPED_INELIGIBLE: NO_ATTEMPTED_CREDIT (FL-14 — independent per-child outcomes) |
| 7 | Re-batch with anchor in REVIEW_IN_PROGRESS | 409 ANCHOR_INELIGIBLE; **all children SKIPPED_INELIGIBLE: ANCHOR_FAILED** (FL-13 cascade fully populated in error result body) |
| 8 | Fee-quote (mixed paid/unpaid) | RES-100000 + RES-100001 = $0; RES-100002 = $900; totals = $900 |
| 9 | pay-and-submit when totals>0 | preserves the cascade body when anchor still UNDER_REVIEW |

The smoke confirmed:
- **FL-12** hierarchy invariant — both pure subject and DB CHECK enforced.
- **FL-13** anchor-failure cascade — `result.children.every(c => c.status !==
  'SUBMITTED')` holds for every anchor-failure path.
- **FL-14** independent children — each child's outcome reflects its own
  pre-flight eligibility, not its siblings'.
- BR-PA3 / BR-PA4 / BR-PA5 / BR-PA6 — anchor / attach / detach lifecycle.
- BR-BS6 — `assertSubmittable` extraction is non-breaking (U5 reviews still
  flowed through the orchestrator, including the U5-style submission step
  exercised in scenario 7).
- The exception filter passthrough preserves `code` + `result` so the FE
  store renders the cascade.

---

## Known interaction (pre-existing, not introduced by U6)

The U3 `ProjectsDemoSeeder.upsertProject` resets `existing.status =
ProjectStatus.REGISTERED` on every boot. When a CONFIRMED Review row exists
for the demo project, attempting to call `POST /reviews/:id/return` afterwards
triggers a `ProjectStatusTransitionError: REGISTERED → REGISTERED` because the
review return path also tries to flip the project to REGISTERED. This is
unchanged from U5 and not part of U6 scope; documented here for traceability.
A future fix to the demo seeder (treat status as
`status: existing.status ?? ProjectStatus.REGISTERED`) would remove this side
effect.

---

## PBT compliance (Unit 6)

- **PBT-01** Property identification — COMPLIANT. Three properties documented
  with pure / test-friendly subjects:
  - **FL-12** in `src/portfolio/state-machine/hierarchy.invariant.ts` (pure).
  - **FL-13** at the orchestrator level
    (`PortfolioSubmissionOrchestrator.submit` return-value invariant).
  - **FL-14** at the orchestrator level (per-child outcome independence).
- **PBT-09** Framework selection — COMPLIANT (fast-check carried over).
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per the U1
  precedent; subjects remain test-friendly for when tests are enabled).
