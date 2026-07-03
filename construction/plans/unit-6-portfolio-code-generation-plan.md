# Unit 6 — Portfolio — Code Generation Plan

**Cadence**: NFR Requirements + NFR Design SKIPPED for U6 (carried forward from U3/U4/U5). All
cross-cutting NFRs from U1+U2+U4+U5 inherit unchanged. Tests skipped per the documented PBT
deviation (PBT-01 properties are identified; PBT-02..08, PBT-10 deferred).

**Scope**: stories US-5.1, US-5.2, US-5.3, US-7.2 — anchor designation + hierarchy + portfolio
dashboard + batch submit (anchor-failure cascade + independent children) + combined-fee quote.

**Approach**: Phase A (backend, Steps 1-22) → Phase B (frontend, Steps 23-32) → Phase C
(documentation + validation, Steps 33-40).

---

## Phase A — Backend (Steps 1-22)

### A.1 — DDL + Project entity extension

- [x] **1.** Extend `src/projects/project.entity.ts`: add column
      `is_portfolio_anchor: boolean NOT NULL DEFAULT false` (`@Column({ name:
      'is_portfolio_anchor', type: 'boolean', default: false })`). The existing
      `parentAnchorId` column stays as-is.
- [x] **2.** Extend `src/projects/registration-ddl.bootstrapper.ts`:
      - Add (idempotent) `ALTER TABLE project ADD CONSTRAINT project_no_self_parent_chk CHECK
        (parent_anchor_id IS NULL OR parent_anchor_id <> id)`.
      - Add (idempotent) `ALTER TABLE project ADD CONSTRAINT project_anchor_no_parent_chk
        CHECK (NOT (is_portfolio_anchor = true AND parent_anchor_id IS NOT NULL))`.
      - Add (idempotent) `ALTER TABLE project ADD CONSTRAINT project_parent_anchor_fk FOREIGN
        KEY (parent_anchor_id) REFERENCES project(id) ON DELETE RESTRICT`.
      - Add (idempotent) `CREATE INDEX IF NOT EXISTS project_parent_anchor_idx ON project
        (parent_anchor_id) WHERE parent_anchor_id IS NOT NULL`.
      - All wrapped in `DO $$ BEGIN ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
        for the constraint statements. Log each addition once on first creation.

### A.2 — Pure hierarchy invariant

- [x] **3.** Create `src/portfolio/state-machine/hierarchy.invariant.ts` with the
      `HierarchyCandidate` interface and `assertHierarchy(child, candidate)` pure function
      per `business-logic-model.md`. No Nest imports.

### A.3 — DTOs

- [x] **4.** Create `src/portfolio/dto/patch-anchor.dto.ts` (`{ isPortfolioAnchor: boolean }`)
      and `src/portfolio/dto/patch-parent-anchor.dto.ts`
      (`{ parentAnchorId: string | null }`). `class-validator` annotations: `@IsBoolean()`,
      `@IsUUID()` / `@IsOptional()`.
- [x] **5.** Create `src/portfolio/dto/portfolio-dashboard.dto.ts` with `ProjectSummaryDto`,
      `LatestReviewSummaryDto`, `PortfolioRollupDto`, `PortfolioDashboardDto`.
- [x] **6.** Create `src/portfolio/dto/portfolio-fee-quote.dto.ts` with
      `PortfolioFeeQuoteLineItemDto`, `PortfolioFeeQuoteDto`.
- [x] **7.** Create `src/portfolio/dto/batch-submit-result.dto.ts` with `SkipReason` type,
      `ChildSubmitOutcomeDto`, `AnchorSubmitOutcomeDto`, `BatchSubmitResultDto`,
      `PortfolioSubmitDto` (`{ phase: ReviewPhase }`).

### A.4 — Refactor: extract `assertSubmittable` from `SubmissionOrchestrator`

- [x] **8.** Refactor `src/review/submission.orchestrator.ts`:
      - Extract a private `validateSubmittable(projectId, phase, actor):
        Promise<{ project: Project; existing: Review | null }>` containing the existing
        `assertSubmitter` + status check + phase ordering + attempted-count + existing-review
        check logic.
      - Add a public `assertSubmittable(projectId, phase, actor): Promise<void>` thin wrapper.
      - Update `submit(...)` to call `validateSubmittable` once at the top; reuse the returned
        `project` and `existing` to avoid a second look-up (preserve identical behavior).
      - Diagnostics must remain clean; no API change for U5 callers.

### A.5 — `PortfolioService` (anchor + attach + detach + dashboard)

- [x] **9.** Create `src/portfolio/portfolio.service.ts`:
      - `toggleAnchor(projectId, isAnchor, actor): Promise<Project>` — implements Flow 1.
        Uses `StateLockService.assertWritable(projectId, actor)`, persists, audits.
      - `setParentAnchor(childId, parentAnchorId | null, actor): Promise<Project>` — Flow 2.
        Calls `assertHierarchy`. On `null`, detaches.
      - `assertCanUnanchor(anchorId): Promise<void>` — implements BR-PA3 + BR-PA4. Throws
        `ConflictException('ANCHOR_HAS_CHILDREN' | 'PORTFOLIO_BUSY')`.
      - `buildDashboard(anchorId): Promise<PortfolioDashboardDto>` — Flow 3 with the two
        per-project queries (scorecard rollup, latestReview).
      - Inject: `Repository<Project>`, `Repository<ScorecardEntry>`, `Repository<Review>`,
        `AuditService`, `StateLockService`, `Logger`.
- [x] **10.** Map `assertHierarchy`'s `Error('HIERARCHY_*')` to `ConflictException` with the
      same `code` field on the problem-json body. Centralize in a helper inside the service.

### A.6 — `PortfolioFeeService`

- [x] **11.** Create `src/portfolio/portfolio-fee.service.ts`:
      - `quote(anchorId, phase): Promise<PortfolioFeeQuoteDto>` — Flow 4.
      - For each project: query `Invoice` for a paid row, then call `FeeCalculator.compute`
        only when none exists. Sum line items, dedupe warnings.
      - Inject: `Repository<Project>`, `Repository<Invoice>`, `FeesService` (or expose
        `FeeCalculator` directly via a helper), `Logger`.

### A.7 — `PortfolioSubmissionOrchestrator`

- [x] **12.** Create `src/portfolio/portfolio-submission.orchestrator.ts`:
      - `submit(anchorId, phase, actor): Promise<BatchSubmitResultDto>` — Flow 5.
      - Helper `mapSubmitErrorToSkip(err): SkipReason | null` per the table in
        `business-logic-model.md`.
      - Sequential children loop sorted by `gbciDisplayId ASC NULLS LAST` for log determinism.
      - Audit at orchestrator boundary (one batch row + one per child outcome).
      - Inject: `SubmissionOrchestrator`, `Repository<Project>`, `MembershipService`,
        `AuditService`, `Logger`.
- [x] **13.** When the anchor is ineligible, throw `ConflictException` with body
      `{ code: 'ANCHOR_INELIGIBLE', result: BatchSubmitResultDto }`. When the anchor's
      `submit` throws, throw `InternalServerErrorException` with body `{ code:
      'ANCHOR_FAILED', result: BatchSubmitResultDto }`. The result has `children` populated
      with `SKIPPED_INELIGIBLE { reason: 'ANCHOR_FAILED' }` for every child (FL-13).

### A.8 — `PortfolioController`

- [x] **14.** Create `src/portfolio/portfolio.controller.ts`:
      - `PATCH /projects/:projectId/anchor` — `toggleAnchor`. RBAC: `@ProjectRoles(PT, GR)` on
        `:projectId` (controller param) or global Admin. `@StampAuditOnRequest`.
      - `PATCH /projects/:projectId/parent-anchor` — `setParentAnchor`. Same RBAC.
      - `GET /projects/:anchorId/portfolio` — `buildDashboard`. RBAC: any project member on
        anchor or Admin (use a permissive `@ProjectRoles(OWNER, PT, GR, REVIEWER)` pattern).
      - `GET /projects/:anchorId/portfolio/fee-quote` — `quote`. Same RBAC as dashboard.
      - `POST /projects/:anchorId/portfolio/submit` — `batchSubmit`. RBAC: PT/GR on anchor or
        Admin.
      - `POST /projects/:anchorId/portfolio/pay-and-submit` — `payAndSubmit`. Same RBAC.
- [x] **15.** OpenAPI annotations: `@ApiTags('portfolio')`, `@ApiOperation`, `@ApiResponse`
      with `BatchSubmitResultDto` schemas. Match the U3/U5 conventions.

### A.9 — `PortfolioModule`

- [x] **16.** Create `src/portfolio/portfolio.module.ts`:
      - `imports`: `TypeOrmModule.forFeature([Project, Invoice, ScorecardEntry, Review])`,
        `MembershipModule`, `ProjectsModule` (exports `ProjectsService`), `ScorecardModule`
        (exports `StateLockService`), `ReviewModule` (exports `SubmissionOrchestrator`),
        `FeesModule`, `AuditModule`.
      - `controllers`: `PortfolioController`.
      - `providers`: `PortfolioService`, `PortfolioFeeService`,
        `PortfolioSubmissionOrchestrator`.
- [x] **17.** Update `src/app.module.ts`: import `PortfolioModule`. No new entities to register
      directly here (TypeOrmModule.forFeature in PortfolioModule covers the new column on the
      existing `Project` entity).

### A.10 — Project DTO extension

- [x] **18.** Extend `src/projects/dto/project.dto.ts`: include `isPortfolioAnchor` and the
      already-existing `parentAnchorId` in `ProjectDto.toDto`. Update OpenAPI schema.
- [x] **19.** Extend list endpoint (`projects.controller.ts`'s GET-list route) with optional
      query params `?isPortfolioAnchor=true|false` and `?parentAnchorId=<uuid>` to support the
      designate-anchor dialog's project picker. Use TypeORM `where` builder additions.

### A.11 — Edge-case handling

- [x] **20.** When `PortfolioController.toggleAnchor` is called on a project that is already
      in the requested state, return 200 with the unchanged DTO, no audit row (idempotent).
- [x] **21.** When `setParentAnchor` is called with `parentAnchorId === current value`, same
      idempotent path.
- [x] **22.** Validate the `phase` query parameter on fee-quote and submit endpoints with
      `@IsEnum(ReviewPhase)`; reject unknown phases with 400.

---

## Phase B — Frontend (Steps 23-32)

### B.1 — DTOs + ApiClient

- [x] **23.** Extend `src/app/core/api/dto.ts` with the U6 shapes per
      `frontend-components.md`. Export everything from the barrel.
- [x] **24.** Extend `src/app/core/api/api-client.ts` with the 6 new methods. Mirror existing
      observable patterns; map HTTP errors with the `{ code, result }` body to a typed
      `BatchSubmitError` class.

### B.2 — Portfolio store

- [x] **25.** Create `src/app/features/portfolio/portfolio.store.ts` — a signal-based store
      per `frontend-components.md`. Methods: `load`, `refresh`, `submitBatch`, `payAndSubmit`,
      `clearBatchResult`.

### B.3 — Components

- [x] **26.** Create `src/app/features/portfolio/portfolio-page.component.ts` (+ template +
      styles) — the main dashboard page. Material card for anchor summary + Material table
      for children + rollup band. Action buttons.
- [x] **27.** Create `src/app/features/portfolio/designate-anchor.dialog.component.ts` — two-
      mode dialog (anchor toggle + attach autocomplete). Calls `patchAnchor` /
      `patchParentAnchor`. Maps backend errors to friendly text per `frontend-components.md`.
- [x] **28.** Create `src/app/features/portfolio/batch-submit.dialog.component.ts` — phase
      picker, eligibility preview (client-side from dashboard data), fee-quote preview, confirm
      action. Renders `BatchSubmitResultDto` after the call. Surfaces the cascade banner when
      the anchor failed.
- [x] **29.** Extend `src/app/features/projects/project-detail-page.component.ts`: add the
      "Portfolio" section (button to dashboard when anchor; chip + link when child; designate
      / attach buttons when neither). Inject the store / open dialogs as needed.

### B.4 — Routing + lazy loading

- [x] **30.** Update `src/app/app.routes.ts`: add the lazy `/projects/:anchorId/portfolio`
      route guarded by the existing auth guard.

### B.5 — Edge-case handling

- [x] **31.** Add an `<usgbc-empty-state>` for the portfolio-page when the loaded project is
      not actually an anchor (server returns 409 NOT_AN_ANCHOR). CTA: "Designate this project
      as an anchor" → opens designate-anchor.dialog.
- [x] **32.** Handle the BR-PF2 forward-compat error
      (`501 PORTFOLIO_COMBINED_PAYMENT_NOT_IMPLEMENTED`) in batch-submit.dialog: disable the
      "Pay & submit" CTA and show the explanatory text from the response body. Allow the user
      to switch to "Submit only" (calls `submitPortfolio`) when totalCents > 0 — only if they
      have separately paid each project's registration.

---

## Phase C — Documentation + Validation (Steps 33-40)

- [x] **33.** Create `aidlc-docs/construction/unit-6-portfolio/code/README.md`: list created
      files, smoke-test summary, endpoint quick reference, scope deviations.
- [x] **34.** Update `usgbc-hub-residential-be/README.md`: change "Units 1–5 complete" to
      "Units 1–6 complete"; add the new endpoints under a "Portfolio" section; update project
      layout listing to include `src/portfolio/`.
- [x] **35.** Update `usgbc-hub-residential-fe/README.md`: change "Units 1–5 complete" to
      "Units 1–6 complete"; add the new portfolio route.
- [x] **36.** Update `aidlc-docs/inception/application-design/unit-of-work-story-map.md`:
      mark US-5.1, US-5.2, US-5.3, US-7.2 as `[x] U6`.
- [x] **37.** Update `aidlc-state.md`:
      - Construction matrix U6 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`,
        CodeGen ✅.
      - Feature → Unit map: portfolio rows from ⏳ to ✅.
      - Current Stage line → "Unit 6 complete (FD only; NFRR/NFRD skipped per user); awaiting
        approval to proceed to Unit 7".
- [x] **38.** Run `npm run build` in both BE and FE workspaces; capture clean output.
- [x] **39.** Run `get_diagnostics` on every new/modified TypeScript file (target: 0 issues).
- [x] **40.** Run an end-to-end smoke test against the running stack (BE :3000, FE :4200):
      - PT designates two existing projects as portfolio anchors → 200 + audit log entry.
      - Attach existing children to the anchors via PATCH → 200; constraint violations
        rejected with 409 (FL-12).
      - GET dashboard → returns rollup; reads succeed for non-PT members.
      - Toggle anchor off while children attached → 409 ANCHOR_HAS_CHILDREN.
      - Detach all children, toggle anchor off → 200.
      - Re-anchor + re-attach + batch submit (PRELIMINARY) → BatchSubmitResultDto with anchor
        SUBMITTED + children SUBMITTED.
      - Make anchor ineligible (e.g., already UNDER_REVIEW) and trigger batch → 409
        ANCHOR_INELIGIBLE with all children SKIPPED_INELIGIBLE: ANCHOR_FAILED (FL-13).
      - Make one child ineligible (e.g., 0 attempted credits) and trigger batch → siblings
        still submit successfully; that child SKIPPED_INELIGIBLE: NO_ATTEMPTED_CREDIT (FL-14).
      - GET fee-quote with paid children → totalCents = 0; lineItems show registrationFeeCents
        = 0.
      - pay-and-submit with totalCents = 0 → equivalent to submit (200).

---

## Story coverage table

| Story | Steps |
|---|---|
| US-5.1 Designate anchor + attach child | 1, 2, 3, 4, 9, 10, 14, 18, 19, 27, 29 |
| US-5.2 Portfolio dashboard | 5, 9, 14, 25, 26, 30, 31 |
| US-5.3 Pay & submit portfolio together | 6, 7, 11, 12, 13, 14, 15, 28, 32 |
| US-7.2 Batch submit (anchor cascade + independent children) | 7, 8, 12, 13, 14, 15, 28 |
| Cross-cutting RBAC | 14, 19, 27, 29 |
| Cross-cutting state-lock interplay | 9, 14 (no behavior change; carry-forward) |
| Cross-cutting audit | 9, 12, 14 |
| PBT-01 properties | 3 (FL-12), 12 (FL-13, FL-14) |
| Documentation | 33-37 |
| Validation | 38, 39, 40 |

---

## PBT compliance for this unit

- **PBT-01** Property identification: COMPLIANT — three properties documented (FL-12, FL-13,
  FL-14) with pure / test-friendly subjects implemented.
- **PBT-09** Framework selection: COMPLIANT — fast-check carried over from prior units.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per Unit 1
  precedent.

No blocking PBT findings. The codebase remains test-friendly for when tests are turned back on.
