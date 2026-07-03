# Code Generation Plan — Unit 4: Workbook

**Source of truth** for U4 Code Generation. NFR Requirements + NFR Design stages SKIPPED per
user direction (carried forward from U3); all cross-cutting NFRs inherit from U1+U2 unchanged.
Tests skipped per the documented U1 PBT deviation.

---

## Unit Context

- **Workspace root**: `/Users/hbayyapu/usgbc-hub-residential`
- **Backend dir**: `usgbc-hub-residential-be/`
- **Frontend dir**: `usgbc-hub-residential-fe/`
- **Doc summary**: `aidlc-docs/construction/unit-4-workbook/code/`

### Stories
- US-4.1 Scorecard ↔ Workbook binding (auto-create on attempted-toggle; soft-archive on
  un-attempt)
- US-4.2 Field Verification section (inline inputs, calculators, area-tagged groups)
- US-4.3 Submittals with named upload slots (local S3-compatible storage; broad MIME set)
- US-4.4 Three-column verification notes (per-column save with timestamp + author)
- US-4.5 Section collapse/expand (FE only; sessionStorage-persisted)

### Dependencies
- Unit 1 (auth, RBAC, audit, request context, throttler).
- Unit 2 (catalog credits + the U2-disabled view-tabs that U4 activates).
- Unit 3 (real `Project` entity).

### Database entities owned by this unit
- `WorkbookFieldDefinition`, `SubmittalSlotDefinition`, `WorkbookFieldEntry`, `SubmittalSlot`,
  `Submittal`, `VerificationNote`.

### NPM dependencies added
- Backend: none (jose JWT lib already present via `jsonwebtoken` for U1; multer already
  added in U3 for bulk).
- Frontend: none.

---

## Generation Steps

### Backend — Common hook registry

- [x] **Step 1** Create `src/common/hooks/workbook-attempt-hook.registry.ts` — global
  `WorkbookAttemptHookRegistry` (`@Global` module). Exports a registry where listeners
  register and ScorecardService notifies on attempted-flips. Tolerates listener exceptions.
- [x] **Step 2** Create `src/common/hooks/hooks.module.ts` (`@Global`) providing the
  registry.
- [x] **Step 3** Modify `src/scorecard/scorecard.service.ts` — inject the registry; call
  `registry.notify({ projectId, creditId, attempted, actor })` from the two attempted-flip
  paths (`toggleAttempted` and `setPoints` when `patch.attempted` materially changes).
- [x] **Step 4** Update `src/app.module.ts` — import the new `HooksModule` (global).

### Backend — Workbook domain

- [x] **Step 5** Create `src/workbook/enums/workbook.enums.ts` exporting `NoteColumn`,
  `WorkbookFieldDataType`.
- [x] **Step 6** Create the catalog (definition) entities:
  - `src/workbook/workbook-field-definition.entity.ts`
  - `src/workbook/submittal-slot-definition.entity.ts`
- [x] **Step 7** Create the per-project entities:
  - `src/workbook/workbook-field-entry.entity.ts`
  - `src/workbook/submittal-slot.entity.ts`
  - `src/workbook/submittal.entity.ts`
  - `src/workbook/verification-note.entity.ts`
- [x] **Step 8** Create DTOs under `src/workbook/dto/`:
  - `workbook-field-definition.dto.ts`
  - `workbook-field-entry.dto.ts` + `set-workbook-field.dto.ts` + `set-workbook-field-response.dto.ts`
  - `submittal-slot-definition.dto.ts`
  - `submittal.dto.ts` + `submittal-slot.dto.ts`
  - `verification-note.dto.ts` + `set-note.dto.ts`
  - `workbook.dto.ts` + `workbook-flags.dto.ts` + `signed-download-url.dto.ts`

### Backend — Calculator registry (pure)

- [x] **Step 9** Create `src/workbook/calculators/formula-registry.ts` — pure module, no
  Nest imports. `formulaRegistry: Record<string, (scope: FormulaScope) => unknown>`. Two
  named formulas (`sum_numeric_inputs`, `threshold_boolean`) plus a `pass_through` fallback.
  PBT-01 target FL-6.

### Backend — Storage seam

- [x] **Step 10** Create `src/workbook/storage/file-storage.provider.ts` — interface +
  injection token `FILE_STORAGE_PROVIDER`.
- [x] **Step 11** Create `src/workbook/storage/local-disk-storage.provider.ts` — implements
  the seam; writes under `data/submittals/...` relative to BE working dir; ensures parent
  dir exists; deletes safely (path-traversal guard).
- [x] **Step 12** Create `src/workbook/storage/key.utils.ts` — pure `buildKey()` /
  `parseKey()` helpers (PBT-01 target FL-8). Filename sanitization helper here too.
- [x] **Step 13** Add `data/` to `.gitignore` if not already present (guarded).

### Backend — Catalog seeder

- [x] **Step 14** Author `scripts/seed/leed-v41-sf-workbook.json` — hand-curated subset
  covering ~6-8 representative credits (one per category) with both field defs (mix of all
  dataTypes) and slot defs (mix of single + multi). Two derived fields use the formula
  registry to exercise the wiring.
- [x] **Step 15** Create `src/workbook/workbook-catalog.seeder.ts` — `OnModuleInit` after
  `CatalogSeeder`; idempotent upserts; seed-time invariant assertions per BR-WC3
  (creditSlug exists in U2 catalog, formulaKey exists in registry, enum invariants).

### Backend — Workbook orchestrator + service

- [x] **Step 16** Create `src/workbook/workbook.orchestrator.ts` — `materializeForCredit` +
  `archiveForCredit` per BL-1/BL-2. `OnModuleInit` registers the listener with
  `WorkbookAttemptHookRegistry`. Exposes a small API used by the WorkbookService too.
- [x] **Step 17** Create `src/workbook/workbook.service.ts` — read paths (BL-3), write
  field entries (BL-4 with calculator hook), notes save (BL-7), workbook flags (BL-8),
  authorization helpers, state-lock calls.
- [x] **Step 18** Create `src/workbook/submittals.service.ts` — upload (BL-5), download URL
  (BL-6 sign), delete; uses `FileStorageProvider`.

### Backend — Controllers

- [x] **Step 19** Create `src/workbook/workbook.controller.ts` exposing
  `GET /projects/:projectId/workbook`,
  `GET /projects/:projectId/workbook/flags`,
  `PUT /projects/:projectId/workbook/credits/:creditId/fields`,
  `PUT /projects/:projectId/workbook/credits/:creditId/notes/:column`.
  Protected by `ProjectRolesGuard` with `@ProjectRoles('*')`.
- [x] **Step 20** Create `src/workbook/submittals.controller.ts` exposing
  `POST /projects/:projectId/workbook/credits/:creditId/slots/:slotKey/files` (multipart),
  `DELETE /projects/:projectId/workbook/files/:submittalId`,
  `GET /projects/:projectId/workbook/files/:submittalId/url` (signed-URL minting).
  Per-route `@Throttle(20, 60)` on uploads.
- [x] **Step 21** Create `src/workbook/submittal-files.controller.ts` exposing the public
  signed-token streamer `GET /api/v1/submittals/files/:token` — token verification, MIME +
  Content-Disposition headers, stream from provider.
  - Marked `@Public()` since the token carries its own auth (5-minute expiry).

### Backend — Demo seed bridge

- [x] **Step 22** Create `src/workbook/workbook.demo-seeder.ts` — `OnModuleInit` after
  `WorkbookCatalogSeeder` and `ScorecardModule.DemoSeeder`. For the demo project, calls
  `materializeForCredit` for every attempted credit (idempotent), pre-populates a couple of
  field entries, seeds one fixture submittal file via the storage provider, populates one
  three-column note set so the FE renders something.
- [x] **Step 23** Create `scripts/seed/fixtures/sample-evidence.txt` (a tiny dummy file the
  demo seeder uploads).

### Backend — Module wiring

- [x] **Step 24** Create `src/workbook/workbook.module.ts` — registers all entities under
  TypeORM, providers (orchestrator, services, calculators registry token, storage provider
  token bound to LocalDisk), controllers, demo seeder; imports `CatalogModule` (for
  WorkbookCatalogSeeder), `ScorecardModule` (for read paths that consult attempted entries),
  `MembershipModule` (for project-roles guards), `AuditModule`. Exports nothing — the module
  is consumed only via HTTP and the hook registry.
- [x] **Step 25** Modify `src/app.module.ts` — register the new entities under TypeORM and
  add `WorkbookModule` to imports.

### Backend — Tests — SKIPPED PER DOCUMENTED DEVIATION
- [ ] ~~Step 26~~ **Skipped** — PBT for `formulaRegistry` (FL-6).
- [ ] ~~Step 27~~ **Skipped** — PBT for `materializeForCredit` idempotence (FL-7).
- [ ] ~~Step 28~~ **Skipped** — PBT for file-key round-trip (FL-8).
- [ ] ~~Step 29~~ **Skipped** — example tests for orchestrator paths.

### Frontend — DTOs & ApiClient extension

- [x] **Step 30** Extend `src/app/core/api/dto.ts` with all U4 shapes (Workbook,
  WorkbookFieldDefinition/Entry, SubmittalSlot/Submittal, VerificationNote, WorkbookFlags,
  SignedDownloadUrl).
- [x] **Step 31** Extend `src/app/core/api/api-client.ts` with U4 endpoints
  (`getWorkbook`, `getWorkbookFlags`, `setWorkbookField`, `uploadSubmittal`,
  `deleteSubmittal`, `getSignedSubmittalUrl`, `saveVerificationNote`).

### Frontend — Workbook feature

- [x] **Step 32** Create `features/workbook/workbook.store.ts` (Signals; sessionStorage
  collapse persistence keyed `gbci.workbook.collapse:${projectId}`).
- [x] **Step 33** Create `features/workbook/workbook-page.component.ts` (top-level layout,
  loops over attempted credits).
- [x] **Step 34** Create `features/workbook/credit-section/field-verification-section.component.ts`
  (area-grouped inputs by `dataType`, range-warning surface, derived-field read-only display).
- [x] **Step 35** Create `features/workbook/credit-section/submittals-section.component.ts`
  (one block per slot, multi-upload variant, upload/download/delete actions).
- [x] **Step 36** Create `features/workbook/credit-section/notes-section.component.ts`
  (the three-column notes editor with per-column save + timestamp + author).
- [x] **Step 37** Create `features/workbook/components/file-uploader.component.ts`
  (drag-drop zone with MIME + size pre-check matching backend; calls upload via the store).

### Frontend — U2 view-tabs activation

- [x] **Step 38** Update
  `features/scorecard/components/scorecard-view-tabs/scorecard-view-tabs.component.ts` —
  remove disabled-with-tooltip from the three U4-relevant tabs; add a `flags` input; emit
  filter mode to the parent.
- [x] **Step 39** Update `features/scorecard/scorecard.store.ts` — add a `workbookFlags`
  signal; `loadWorkbookFlags(projectId)` calls `apiClient.getWorkbookFlags(...)`. Filter
  the rendered category-row list when the active tab is non-`All`.
- [x] **Step 40** Update `features/scorecard/scorecard-page/scorecard-page.component.ts` —
  call `loadWorkbookFlags` on init; wire the new tab change listener; add an inline "Open
  workbook ↗" link on each filtered credit row.

### Frontend — App shell wiring

- [x] **Step 41** Update `src/app/app.routes.ts` adding `/projects/:projectId/workbook`
  (lazy-loaded). Place after the scorecard route.
- [x] **Step 42** Update `src/app/app.component.ts` (or the project detail page) adding a
  "Workbook" link/button alongside the existing "Scorecard" link on project detail.

### Frontend — Tests — SKIPPED
- [ ] ~~Step 43~~ **Skipped** — FE PBT mirror of `formulaRegistry` and example component tests.

### Documentation

- [x] **Step 44** Create `aidlc-docs/construction/unit-4-workbook/code/README.md`
  (file inventory, run instructions, endpoints, story coverage, PBT deviation note,
  NFRR/NFRD-skip note).
- [x] **Step 45** Update `usgbc-hub-residential-be/README.md` to "Units 1–4 complete" with
  workbook endpoints quick reference and updated project layout (added `workbook/`).
- [x] **Step 46** Update `usgbc-hub-residential-fe/README.md` to "Units 1–4 complete" with
  the new workbook route and view-tabs activation note.

### Validation

- [x] **Step 47** Diagnostics clean across all created/modified files.
- [x] **Step 48** No duplicate file artifacts (`*_modified.ts`, `*_new.ts`).
- [x] **Step 49** Mark all 5 U4 stories `[x]` in `aidlc-docs/inception/application-design/
  unit-of-work-story-map.md`.
- [x] **Step 50** Smoke test: backend boots, workbook catalog seeded, demo project's
  attempted credits materialize their workbook rows, fee-quote and registration flows from
  U3 still work, scorecard toggle-attempted on a fresh credit triggers materialization,
  un-attempt soft-archives, file upload + download round-trips through `LocalDiskStorageProvider`,
  three-column note save returns timestamped row.

---

## Story Coverage

| Story | Steps |
|---|---|
| US-4.1 (binding) | 1, 2, 3, 16, 17, 22 |
| US-4.2 (field verification) | 6, 7, 8, 9, 14, 15, 17, 19, 30, 31, 33, 34 |
| US-4.3 (submittals) | 7, 8, 10, 11, 12, 13, 18, 20, 21, 22, 23, 30, 31, 35, 37 |
| US-4.4 (three-column notes) | 7, 8, 17, 19, 30, 31, 36 |
| US-4.5 (collapse/expand) | 32, 33, 34, 35, 36 |

## Total
**50 numbered steps** (5 marked skipped consistent with the U1 PBT deviation).

## PBT Compliance for this stage
- **PBT-01**: COMPLIANT — three properties documented in `business-logic-model.md` FL-6..FL-8
  (calculator determinism + idempotence, materializeForCredit idempotence, file-key
  round-trip). Pure subjects implemented as test-friendly modules without Nest imports.
- **PBT-09**: COMPLIANT — fast-check carried over.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DEVIATION) — tests skipped per Unit 1 precedent.
