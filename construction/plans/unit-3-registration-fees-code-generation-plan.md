# Code Generation Plan — Unit 3: Project Registration & Fees

**Source of truth** for U3 Code Generation. Tests are skipped consistent with the documented
Unit 1 PBT deviation; the steps are present below as `~~Skipped~~` for traceability. NFR
Requirements + NFR Design stages are SKIPPED for U3 per user direction (2026-06-25); all
cross-cutting NFR concerns inherit from U1+U2 unchanged.

---

## Unit Context

- **Workspace root**: `/Users/hbayyapu/usgbc-hub-residential`
- **Backend dir**: `usgbc-hub-residential-be/`
- **Frontend dir**: `usgbc-hub-residential-fe/`
- **Doc summary**: `aidlc-docs/construction/unit-3-registration-fees/code/`

### Stories
- US-2.1 Register an individual project
- US-2.2 Generate GBCI-Certify project number (post pay/commit)
- US-2.3 Capture payment/commitment, generate invoice & confirmation email
- US-2.4 Bulk register via Excel upload (idempotent re-upload)
- US-2.5 Edit registration details post-registration
- US-2.6 Invite users to a project (FE side; BE invite engine landed in U1)

### Dependencies
- Unit 1 (auth, RBAC, audit, request context, throttler, notification gateway, membership).
- Unit 2 (catalog rating systems; existing `ScorecardEntry.projectId` FK becomes real).

### Database entities owned by this unit
- `Project`, `CertificationAgreement`, `Invoice`, `FeeSchedule`, `BulkRegistrationBatch`,
  `BulkRegistrationRow`.
- Plus two Postgres sequences: `projects_display_seq`, `invoices_display_seq` (start 100001).

### NPM dependencies added
- Backend: `exceljs`.
- Frontend: none.

---

## Generation Steps

### Backend — Module & DDL bootstrap

- [x] **Step 1** Add `exceljs` to `usgbc-hub-residential-be/package.json` deps and `npm install`.
- [x] **Step 2** Create `src/projects/registration-ddl.bootstrapper.ts` (`OnModuleInit`; runs
  `CREATE SEQUENCE IF NOT EXISTS projects_display_seq START 100001 NO CYCLE` and the same for
  `invoices_display_seq`; logs first creation).

### Backend — Projects domain

- [x] **Step 3** Create `src/projects/project.entity.ts` (all columns from `domain-entities.md`
  Project; `@Index('uq_projects_display_id', { synchronize: true })` partial-unique-where-not-null
  is approximated by a TypeORM `@Index({ where: 'gbciDisplayId IS NOT NULL', unique: true })`;
  inherits `AuditBase`).
- [x] **Step 4** Create `src/projects/enums/project.enums.ts` exporting `ProjectStatus`,
  `MembershipLevel`, `BuildingType`, `PaymentChoice`, `InvoiceStatus`, `BulkRowStatus`.
- [x] **Step 5** Create `src/projects/certification-agreement.entity.ts`.
- [x] **Step 6** Create `src/projects/agreement-text.ts` exporting `AGREEMENT_TEXT_V1` (string)
  and `AGREEMENT_VERSION_V1 = 'v1.0'`; small standalone module so the hash is stable.
- [x] **Step 7** Create `src/projects/state-machine/project-status.machine.ts` — pure
  `assertTransition(from: ProjectStatus, to: ProjectStatus): void` per BR-P3 (PBT-01 target,
  no Nest imports).
- [x] **Step 8** Create `src/projects/dto/{project.dto.ts, draft-project.dto.ts,
  register-project.dto.ts, register-project-response.dto.ts, patch-project.dto.ts,
  agreement.dto.ts, withdraw-project.dto.ts}`.
- [x] **Step 9** Create `src/projects/project-number.generator.ts` (Injectable; uses
  `EntityManager.query("SELECT nextval('projects_display_seq')")`; idempotency rule on already-
  set `gbciDisplayId` per BR-N3).
- [x] **Step 10** Create `src/projects/projects.service.ts` (find/list/createDraft/patch/withdraw,
  state-machine assertions, audit-stamp helpers, fee-field write rejection per BR-P5).
- [x] **Step 11** Create `src/projects/agreement.service.ts` (sign-agreement subflow per BL-5).
- [x] **Step 12** Create `src/projects/projects.controller.ts` exposing
  `GET /projects` (mine + admin-all),
  `GET /projects/:projectId`,
  `POST /projects` (create draft),
  `PATCH /projects/:projectId`,
  `POST /projects/:projectId/withdraw`,
  `POST /projects/:projectId/agreement`,
  `GET /projects/:projectId/agreement`.
  Routes are protected by `JwtAuthGuard` globally; per-project routes also use
  `ProjectRolesGuard` with `@ProjectRoles('*')`.

### Backend — Fees & Invoice

- [x] **Step 13** Create `src/fees/fee-schedule.entity.ts`.
- [x] **Step 14** Create `src/fees/calculator/fee.calculator.ts` (PURE — no Nest imports;
  signature `compute(input: FeeInput): FeeQuote`; returns `warnings: ['no_fee_schedule_match']`
  when no row matches). PBT-01 target FL-1.
- [x] **Step 15** Create `src/fees/fee-schedule.seeder.ts` (`OnModuleInit`, idempotent upserts
  by `(ratingSystemSlug, membershipLevel)`; fail-fast if `currency !== 'USD'`).
- [x] **Step 16** Author `scripts/seed/fee-schedule.json` covering both LEED v4.1 SF tiers
  (e.g., `USGBC_MEMBER → 90000` ($900), `NON_MEMBER → 120000` ($1200) — placeholder values
  noted as not the published GBCI prices but reasonable for the demo).
- [x] **Step 17** Create `src/fees/dto/{fee-quote.dto.ts, fee-input.dto.ts}`.
- [x] **Step 18** Create `src/fees/fees.service.ts` (orchestrates schedule lookup +
  calculator; exposes `quote(slug, level): FeeQuote`).
- [x] **Step 19** Create `src/fees/fees.controller.ts` (`GET /registration/fee-quote`).
- [x] **Step 20** Create `src/fees/payment-provider.interface.ts` (`PaymentProvider` seam).
- [x] **Step 21** Create `src/fees/payment-provider.mock.ts` (records intent only; returns
  `{ providerRef: 'mock_intent_${uuid}', status: 'succeeded' }`).
- [x] **Step 22** Create `src/fees/invoice.entity.ts`.
- [x] **Step 23** Create `src/fees/invoice.service.ts` (uses `nextval('invoices_display_seq')`
  for display ID; enforces totals invariant BR-I5; calls `PaymentProvider` for PAY_NOW).
- [x] **Step 24** Create `src/fees/invoice.controller.ts` (`GET /projects/:projectId/invoice`).
- [x] **Step 25** Create `src/fees/fees.module.ts` (exports `FeesService`, `InvoiceService`,
  `PaymentProvider` token, `FeeSchedule` repo).

### Backend — Registration orchestration

- [x] **Step 26** Create `src/projects/registration.orchestrator.ts` implementing BL-1
  (resolveOrCreateDraft → assertReadiness → recordAgreement → computeFee → generateInvoice →
  allocateProjectNumber → sendConfirmationEmail) inside a single TypeORM transaction; email
  sent post-commit. Auto-creates `PROJECT_TEAM` membership for the actor.
- [x] **Step 27** Add `POST /projects/register` to `projects.controller.ts` invoking the
  orchestrator. Returns `RegisterProjectResponseDto`.

### Backend — Bulk registration

- [x] **Step 28** Create `src/projects/bulk/bulk-registration-batch.entity.ts`.
- [x] **Step 29** Create `src/projects/bulk/bulk-registration-row.entity.ts` with the partial
  unique index `(uploaderUserId, externalRowId) WHERE status = 'CREATED'`.
- [x] **Step 30** Create `src/projects/bulk/bulk-registration.parser.ts` (PURE; uses `exceljs`
  in-memory; header validation; per-row normalization; round-trip helper `serialize(rows)` for
  PBT-01 target FL-2).
- [x] **Step 31** Create `src/projects/bulk/bulk-registration.orchestrator.ts` implementing
  BL-4 (per-row transaction; idempotent re-upload via partial unique index).
- [x] **Step 32** Create `src/projects/bulk/bulk-registration.controller.ts` (`POST
  /projects/bulk` multipart; size & row caps; `@Throttle(5, 60)`).
- [x] **Step 33** Create `src/projects/bulk/dto/{bulk-upload-response.dto.ts,
  bulk-row-outcome.dto.ts}`.

### Backend — Demo seed bridge

- [x] **Step 34** Create `src/projects/projects.demo-seeder.ts` per BL-6 (creates the real
  `Project` row at `DEMO_PROJECT_ID = 00000000-0000-4000-8000-000000000001` if absent, plus a
  fixed-value `Invoice` and `CertificationAgreement`). Uses `gbciDisplayId = 'RES-100000'`
  (below the live sequence floor of `100001`) so it never collides with sequentially-allocated
  numbers.
- [x] **Step 35** ~~Reorder `app.module.ts` so `ProjectsModule` is imported BEFORE `ScorecardModule`.~~
  **Not needed:** Nest's `imports: [...]` order does not control `OnModuleInit` order — the
  dependency graph does. `ProjectsModule` imports `ScorecardModule` (for `StateLockService`), so
  `ScorecardModule.DemoSeeder` initializes first, then `ProjectsDemoSeeder`. Both seeders are
  idempotent; the absence of a real `Project` row at the time `DemoSeeder` writes scorecard
  entries / memberships is benign because no FK constraint references `Project` (forward-declared
  in U2). On second boot everything is consistent.

### Backend — Module wiring

- [x] **Step 36** Create `src/projects/projects.module.ts` exporting `ProjectsService`,
  `RegistrationOrchestrator`, `BulkRegistrationOrchestrator`. Imports
  `TypeOrmModule.forFeature([Project, CertificationAgreement, BulkRegistrationBatch,
  BulkRegistrationRow])`, `FeesModule`, `MembershipModule`, `UsersModule`, `AuditModule`,
  `CatalogModule`.
- [x] **Step 37** Modify `src/app.module.ts`: import `ProjectsModule` and `FeesModule`;
  register the new entities under TypeORM; ensure module ordering matches Step 35.

### Backend — Tests — SKIPPED PER DOCUMENTED DEVIATION
- [ ] ~~Step 38~~ **Skipped** — PBT for `FeeCalculator` (FL-1).
- [ ] ~~Step 39~~ **Skipped** — PBT for `BulkRegistrationParser` round-trip (FL-2).
- [ ] ~~Step 40~~ **Skipped** — PBT for `assertTransition` (FL-4).
- [ ] ~~Step 41~~ **Skipped** — example tests for orchestrator paths.

### Frontend — DTOs & ApiClient extension

- [x] **Step 42** Extend `src/app/core/api/dto.ts` with all U3 shapes from `frontend-components.md`
  ("Shared types extensions" section).
- [x] **Step 43** Extend `src/app/core/api/api-client.ts` with U3 endpoints
  (`listProjects, getProject, createDraft, patchProject, withdrawProject, registerProject,
  getInvoice, getAgreement, getFeeQuote, uploadBulkRegistration`).

### Frontend — Registration wizard

- [x] **Step 44** Create `features/registration/registration.store.ts` (Signals, sessionStorage
  persistence keyed `gbci.draft.registration:${userId}`).
- [x] **Step 45** ~~Create `features/registration/fee-calculator.client.ts` (FE mirror).~~
  **Folded into Step 44.** The store calls `apiClient.getFeeQuote(...)` directly — server is
  authoritative; the FE-side cents → USD formatter is inline on the registration page. A
  separate FE calculator module is unnecessary for this build (the backend is always the source
  of truth for the displayed fee).
- [x] **Step 46** Create `features/registration/registration-page.component.ts` hosting a
  `<mat-stepper>`.
- [x] **Step 47** ~~Create the 8 step components under `features/registration/steps/`.~~
  **Inlined in Step 46.** All five register-mode steps (rating + membership · project details ·
  owner · address · agreement · fees & payment · confirmation) plus the edit-mode "save
  changes" step are rendered directly inside `registration-page.component.ts` with reactive
  bindings into the store. This kept the file count down without sacrificing accessibility (each
  step still gets its own `<mat-step label="…">` and ARIA labels). Splitting becomes worthwhile
  if individual steps grow non-trivial.
- [x] **Step 48** ~~Create the 4 shared components.~~ Only `agreement-modal.component.ts`
  shipped. `fee-quote-card`, `invoice-summary-card`, and `address-fields` were inlined into the
  registration page template (single render path, no reuse pressure yet).

### Frontend — Projects list & detail

- [x] **Step 49** Create `features/projects/projects-list-page/projects-list-page.component.ts`
  + Material table + a "Register a project" CTA.
- [x] **Step 50** Create `features/projects/project-detail-page/project-detail-page.component.ts`
  with editable project-info-panel, links to Scorecard / Edit, Withdraw button (visibility-gated
  by `MeRoleDto`).
- [x] **Step 51** Create `features/projects/invite-member-dialog.component.ts` — invite UI per US-2.6. ~~`members-list.component.ts`~~ **deferred** — current member list is not yet rendered on the detail page; the invite engine itself is fully wired (POST to U1's `/projects/:id/invitations`). A members panel will be added when role-tailored dashboards land in U7.

### Frontend — Bulk upload

- [x] **Step 52** Create `features/bulk/bulk-upload-page.component.ts` with inline drag-drop dropzone, per-row result table, and required-columns help card. ~~Separate `bulk.store.ts` and `<gbci-upload-dropzone>` / `<gbci-per-row-result-table>` / `<gbci-template-help-card>` components~~ were inlined — single-page feature, no reuse pressure.

### Frontend — Edit-mode reuse

- [x] **Step 53** Wire `RegistrationPageComponent` to accept `mode: 'register' | 'edit'`
  (route data) and load an existing `Project` in edit mode; disable fee-related fields.

### Frontend — U2 panel migration

- [x] **Step 54** ~~Update `features/scorecard/components/project-info-panel/project-info-panel.component.ts` to add `mode: 'readonly' | 'editable'` input and an inline editable form when `editable`.~~ **Folded into Step 50.** The editable surface lives on the new `/projects/:projectId` detail page (Material grid with editable invoice / agreement / owner / address cards) reached via the `Edit` button → `RegistrationPageComponent` in edit-mode. The U2 scorecard's read-only `project-info-panel` stays read-only; users now navigate to project detail to edit.

### Frontend — App shell wiring

- [x] **Step 55** Update `src/app/app.routes.ts` adding the 5 routes from `frontend-components.md`
  ("Routes" table). Lazy-load each component.
- [x] **Step 56** Update `src/app/app.component.ts` adding header links: "Projects",
  "Register a project". The "Demo scorecard" link from U2 stays.

### Frontend — Tests — SKIPPED
- [ ] ~~Step 57~~ **Skipped** — FE PBT mirror of `FeeCalculator` and an example registration
  store test.

### Documentation

- [x] **Step 58** Create `aidlc-docs/construction/unit-3-registration-fees/code/README.md`
  (file inventory, run instructions, endpoints, story coverage, PBT deviation note,
  NFRR/NFRD-skip note).
- [x] **Step 59** Update `usgbc-hub-residential-be/README.md` with U3 routes, new env vars
  (none), and updated demo project description (real `Project` entity now).
- [x] **Step 60** Update `usgbc-hub-residential-fe/README.md` with the new routes (`/projects`,
  `/projects/register`, `/projects/:id`, `/projects/:id/edit`, `/projects/bulk`).

### Validation

- [x] **Step 61** Diagnostics clean across all created/modified files.
- [x] **Step 62** No duplicate file artifacts (`*_modified.ts`, `*_new.ts`).
- [x] **Step 63** Mark all 6 U3 stories `[x]` in `aidlc-docs/inception/application-design/
  unit-of-work-story-map.md`.
- [x] **Step 64** Smoke test: backend boots, sequences created, demo project upgraded to a real
  `Project` row at `DEMO_PROJECT_ID` with `gbciDisplayId = RES-100000`, fee-quote endpoint
  returns a quote for `(leed_v4_1_sf, NON_MEMBER)`, register endpoint creates a project + invoice
  + agreement + email log line, bulk endpoint accepts a 1-row valid xlsx and a 1-row invalid
  one with the expected per-row outcomes.

---

## Story Coverage

| Story | Steps |
|---|---|
| US-2.1 (individual register) | 3, 5, 7, 8, 10–12, 14, 17–24, 26, 27, 36, 37, 42–48 |
| US-2.2 (project number) | 2, 9, 26, 64 |
| US-2.3 (fees + invoice + email) | 2, 13–25, 26, 27, 47 (fees-payment + confirmation steps), 48 |
| US-2.4 (bulk) | 1, 28–33, 37, 52, 55, 64 |
| US-2.5 (edit) | 10, 12, 50, 53, 54, 55 |
| US-2.6 (invite UI) | 51, 55 |

## Total
**64 numbered steps** (5 marked skipped consistent with the U1 PBT deviation).

## PBT Compliance for this stage
- **PBT-01**: COMPLIANT — properties documented in `business-logic-model.md` FL-1..FL-5 (FeeCalculator
  determinism + monotonicity, BulkRegistrationParser round-trip, ProjectNumberGenerator format,
  status state machine, invoice total integrity).
- **PBT-09**: COMPLIANT — `fast-check` already in deps from U1.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DEVIATION) — tests skipped per Unit 1 precedent. The
  pure modules (`FeeCalculator`, `BulkRegistrationParser`, `assertTransition`) are coded to
  stay test-friendly (no Nest imports, deterministic) so a future test-pass requires no rework.
