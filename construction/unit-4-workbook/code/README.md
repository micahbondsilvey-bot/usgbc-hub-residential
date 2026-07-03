# Unit 4 — Workbook — Code summary

This is the implementation summary for Unit 4. The plan lives at
`aidlc-docs/construction/plans/unit-4-workbook-code-generation-plan.md`. NFR
Requirements and NFR Design were skipped per user direction (carried forward
from U3); cross-cutting NFR concerns inherit from U1 and U2 unchanged.

---

## Backend file inventory (`usgbc-hub-residential-be/`)

### Cross-module hook (decouples Scorecard ↔ Workbook)
- `src/common/hooks/workbook-attempt-hook.registry.ts` — global tiny event-bus.
- `src/common/hooks/hooks.module.ts` — `@Global()` registration.

### Workbook domain
- `src/workbook/enums/workbook.enums.ts` — `NoteColumn`, `WorkbookFieldDataType`.
- `src/workbook/workbook-field-definition.entity.ts` — catalog row per credit/field.
- `src/workbook/submittal-slot-definition.entity.ts` — catalog row per credit/slot.
- `src/workbook/workbook-field-entry.entity.ts` — per-project values (one column populated per dataType).
- `src/workbook/submittal-slot.entity.ts` — per-project slot instance with `archivedAt`.
- `src/workbook/submittal.entity.ts` — uploaded file metadata + storage key.
- `src/workbook/verification-note.entity.ts` — three-column notes (one row per `(creditId, projectId, NoteColumn)`).

### Calculator registry (pure)
- `src/workbook/calculators/formula-registry.ts` — `formulaRegistry` map of pure functions; ships `sum_numeric_inputs`, `threshold_boolean`, `pass_through`. PBT-01 target FL-6.

### Storage seam
- `src/workbook/storage/file-storage.provider.ts` — interface + `FILE_STORAGE_PROVIDER` token.
- `src/workbook/storage/local-disk-storage.provider.ts` — writes under `data/submittals/...` (gitignored).
- `src/workbook/storage/key.utils.ts` — pure `buildKey`/`parseKey`/`sanitizeFileName`/`isValidKey` (PBT-01 target FL-8).

### Catalog seeder
- `src/workbook/workbook-catalog.seeder.ts` — idempotent upserts; exposes `ready()` Promise so `WorkbookDemoSeeder` can `await` it (Nest runs `onModuleInit` hooks within a module in parallel; this Promise gates the consumer).
- `scripts/seed/leed-v41-sf-workbook.json` — hand-curated catalog for 6 representative credits (20 field defs, 9 slot defs, 2 derived fields exercising the registry).

### Orchestrator + services
- `src/workbook/workbook.orchestrator.ts` — `materializeForCredit` / `archiveForCredit` per BL-1/BL-2; subscribes to the hook registry on module init.
- `src/workbook/workbook.service.ts` — read paths (BL-3), field-entry write with calculator hook (BL-4), notes save (BL-7), workbook flags (BL-8), authorization helpers.
- `src/workbook/submittals.service.ts` — upload (BL-5), signed-URL mint/verify (BL-6), download stream resolver, delete; uses `FileStorageProvider`.

### Scorecard hook integration
- `src/scorecard/scorecard.service.ts` — extended to inject `WorkbookAttemptHookRegistry` and call `notify(...)` from `toggleAttempted` and `setPoints` (when `patch.attempted` materially changes).

### Controllers
- `src/workbook/workbook.controller.ts` — `GET /projects/:projectId/workbook`, `GET /projects/:projectId/workbook/flags`, `PUT /projects/:projectId/workbook/credits/:creditId/fields`, `PUT /projects/:projectId/workbook/credits/:creditId/notes/:column`.
- `src/workbook/submittals.controller.ts` — `POST /projects/:projectId/workbook/credits/:creditId/slots/:slotKey/files` (multipart, `@Throttle(20,60)`), `GET .../files/:submittalId/url`, `DELETE .../files/:submittalId`.
- `src/workbook/submittal-files.controller.ts` — `@Public()` `GET /api/v1/submittals/files/:token` streamer (5-minute JWT TTL).

### Demo seed bridge
- `src/workbook/workbook.demo-seeder.ts` — `OnModuleInit` after the catalog seeder (`await catalogSeeder.ready()`); materializes workbook rows for every attempted credit on the demo project, pre-populates 4 field values, seeds one fixture submittal, populates a three-column note set on the integrative-process credit.
- `scripts/seed/fixtures/sample-evidence.txt` — tiny placeholder file uploaded by the demo seeder.

### Module + app wiring
- `src/workbook/workbook.module.ts` — entities, providers, controllers, storage-provider binding.
- `src/app.module.ts` — registers all 6 new entities under TypeORM, imports `HooksModule` (global) + `WorkbookModule`.

## Frontend file inventory (`usgbc-hub-residential-fe/`)

- `src/app/core/api/dto.ts` — extended with all U4 shapes (Workbook, fields, submittals, notes, flags, signed-URL).
- `src/app/core/api/api-client.ts` — extended with `getWorkbook`, `getWorkbookFlags`, `setWorkbookField`, `uploadSubmittal`, `deleteSubmittal`, `getSignedSubmittalUrl`, `saveVerificationNote`.
- `src/app/features/workbook/workbook.store.ts` — Signals store with `sessionStorage` collapse persistence keyed `gbci.workbook.collapse:${projectId}`.
- `src/app/features/workbook/workbook-page.component.ts` — top-level page (`/projects/:projectId/workbook`), one card per attempted credit with three collapsible sections.
- `src/app/features/workbook/sections/field-verification-section.component.ts` — area-grouped inputs with dataType-specific controls (text/integer/decimal/boolean/enum/date), derived-field disabled display, range warning surface.
- `src/app/features/workbook/sections/submittals-section.component.ts` — drag-drop / click upload, multi-file support, signed-URL download, delete with confirm.
- `src/app/features/workbook/sections/notes-section.component.ts` — three-column editor with per-column save + author + timestamp.
- `src/app/features/scorecard/components/scorecard-view-tabs/scorecard-view-tabs.component.ts` — Field Verification / Submittals / Verification Notes tabs **enabled** (were disabled-with-tooltip in U2).
- `src/app/features/projects/project-detail-page.component.ts` — added "Workbook" link alongside "Scorecard".
- `src/app/app.routes.ts` — added `/projects/:projectId/workbook` lazy route.

## Backend endpoints (new in U4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/projects/:projectId/workbook` | member or admin | Workbook tree (attempted credits only) |
| GET | `/api/v1/projects/:projectId/workbook/flags` | member or admin | Per-credit flags powering view-tab filtering |
| PUT | `/api/v1/projects/:projectId/workbook/credits/:creditId/fields` | Project Team / Green Rater / Admin | Set a field-verification value (override-friendly) |
| PUT | `/api/v1/projects/:projectId/workbook/credits/:creditId/notes/:column` | per-column writers | Save the per-column verification note |
| POST | `/api/v1/projects/:projectId/workbook/credits/:creditId/slots/:slotKey/files` | Project Team / Green Rater / Admin | Multipart upload (25 MB / broad MIME / 20 uploads/min) |
| GET | `/api/v1/projects/:projectId/workbook/files/:submittalId/url` | member or admin | Mint 5-minute signed URL |
| DELETE | `/api/v1/projects/:projectId/workbook/files/:submittalId` | Project Team / Green Rater / Admin | Delete file + DB row |
| GET | `/api/v1/submittals/files/:token` | public (JWT-signed) | Stream the file with `Content-Disposition: attachment` |

## Demo data after seed

- `WorkbookFieldDefinition`: 20 rows across 6 credits (in / lt / wa / ea / mr / eq).
- `SubmittalSlotDefinition`: 9 rows.
- For the demo project, every attempted credit has materialized workbook rows.
- Pre-populated values:
  - `in_credit_integrative_process.kickoff_meeting_held = true`
  - `in_credit_integrative_process.stakeholders_count = 6`
  - `lt_credit_compact_development.site_acres = 1.5`
  - `lt_credit_compact_development.dwelling_units = 12`
- One fixture submittal uploaded under `in_credit_integrative_process / kickoff_meeting_minutes` (`sample-evidence.txt`).
- Three-column notes seeded for `in_credit_integrative_process` (Green Rater / Provider QC / Reviewer).

## Story coverage

| Story | Status | Where |
|---|---|---|
| US-4.1 Scorecard ↔ Workbook binding | ✅ | `WorkbookAttemptHookRegistry` + `WorkbookOrchestrator.materializeForCredit/archiveForCredit` |
| US-4.2 Field Verification | ✅ | `WorkbookService.setFieldValue` with derived recompute via `formulaRegistry`; FE area-grouped inputs |
| US-4.3 Submittals | ✅ | `SubmittalsService` + `LocalDiskStorageProvider` + signed-URL streamer |
| US-4.4 Three-column notes | ✅ | `WorkbookService.saveNote` per-column writers + `<gbci-notes-section>` |
| US-4.5 Section collapse/expand | ✅ | `WorkbookStore.collapseByCredit` with sessionStorage persistence |

## PBT compliance for U4

- **PBT-01**: COMPLIANT — three properties documented (FL-6 `formulaRegistry` determinism + idempotence; FL-7 `materializeForCredit` idempotence; FL-8 file-key round-trip). Pure subjects implemented:
  - `src/workbook/calculators/formula-registry.ts` (FL-6 — no Nest imports)
  - `src/workbook/storage/key.utils.ts` (FL-8 — pure)
  - `WorkbookOrchestrator.materializeForCredit` (FL-7 — idempotence verified by smoke test re-attempt path)
- **PBT-09**: COMPLIANT — fast-check carried over.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per U1 precedent.

## Run instructions

The full local stack (Postgres + Redis + backend on :3000 + frontend on :4200) is unchanged. Restart the BE to pick up the new entities and seed:

```bash
cd usgbc-hub-residential-be && npm run start:dev
```

Visit `http://localhost:4200/projects/00000000-0000-4000-8000-000000000001/workbook` after signing in to see the demo workbook.

Smoke test ideas:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rater@residential.test","password":"Rater123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Workbook GET
curl -s "http://localhost:3000/api/v1/projects/00000000-0000-4000-8000-000000000001/workbook" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -40

# Save a note
curl -s -X PUT "http://localhost:3000/api/v1/projects/00000000-0000-4000-8000-000000000001/workbook/credits/<creditId>/notes/GREEN_RATER" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"body":"Great progress."}'
```

## Plan deviations vs. the original code-gen plan

- **Step 38–40 (scorecard view-tabs filtering)** — **partially shipped**. The three U4-relevant tabs are now enabled (no longer disabled-with-tooltip). The FE-side filtering of scorecard rows by `WorkbookFlagsDto` (showing only credits with content of that section type) is folded into a future iteration; the workbook is the primary surface for U4 and the tabs are kept simple navigation hints. The backend already serves `/workbook/flags` so the filter UX can be wired without code rework.
- **Steps 32–37 inlined three sections** into the workbook page directory rather than a per-step file split into deeper subfolders. Same outcome, fewer files.
