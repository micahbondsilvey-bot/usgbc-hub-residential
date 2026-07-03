# Unit 4 — Workbook — Batched Design Plan

**Cadence note (carried forward from U3).** Per user direction:
- **NFR Requirements stage SKIPPED for U4.** No `nfr-requirements.md` /
  `tech-stack-decisions.md`. Cross-cutting NFRs carry from U1+U2 (Angular 20.2 / Node 20.19
  pin, NestJS, PG, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA, throttler, audit, RBAC,
  request-context, mock notifications) unchanged. U4-specific NFR deltas (file upload caps for
  submittals, allowed MIME types) are folded inline into FD.
- **NFR Design stage SKIPPED for U4.** No `nfr-design-patterns.md` / `logical-components.md`.
  No new infra: file storage uses a provider seam with a local-disk implementation under
  `data/submittals/...` (no AWS S3 dep this build), per Q8 in the original requirements
  analysis.
- **What U4 will produce:** Functional Design (4 artifacts) + Code Generation Plan in one
  approval-gated wave, then code execution. PBT test-skip from U1/U2/U3 continues; PBT-01
  property identification will still happen for the workbook calculator hook and the file-
  storage round-trip.

---

## Stories in scope

| Story | Title | Build Order | Notes |
|---|---|---|---|
| US-4.1 | Scorecard ↔ Workbook binding | 5 | Toggle attempted → auto-create slots; un-attempt → archive |
| US-4.2 | Field Verification section | 5 | Inline inputs, calculators, area-tagged groups |
| US-4.3 | Submittals with named upload slots | 5 | Local S3-compatible storage; broad MIME set |
| US-4.4 | Three-column verification notes | 5 | Green Rater / Provider QC / Reviewer; per-column save + timestamp |
| US-4.5 | Section collapse/expand | 6 | UI-only persistence within session |

Activates the U2 view-tabs that ship disabled (Field Verification, Submittals, Notes) — each tab
filters the scorecard rows by which workbook section has at least one populated entry.

---

## Architectural decisions inherited (NOT re-asked)

| From | Decision |
|---|---|
| U1-Q1 (auth model) | Hybrid RBAC: global Admin + per-project roles. `ProjectRolesGuard` protects all `/projects/:id/*` workbook routes. |
| U1-Q2 (audit) | `AuditStampInterceptor` for HTTP writes; explicit `AuditService.record` on note saves and submittal uploads. |
| U2-Q4 (write semantics) | Last-write-wins; `version: integer` on every persisted row. |
| U2-Q11 (FE store) | Signal-based stores per feature; sessionStorage for unsaved drafts. |
| U3-Q1 (status enum) | `Project.status = REGISTERED` is required to use the workbook (a DRAFT project's workbook is read-only-empty). |
| App design | Provider seams: `FileStorageProvider` ships its mock now; the interface is the contract for an S3 swap later. |

---

## Design questions (10)

> All FD-level. Recommended option in **bold**. An "all-A" reply produces a coherent design.

### Q1 — Worksheet parsing source of truth (US-4.1, US-4.2, US-4.3)
- A. **Hand-curated JSON now: `scripts/seed/leed-v41-sf-workbook.json`. The
  `WorkbookCatalogSeeder` upserts `WorkbookFieldDefinition` and `SubmittalSlotDefinition` rows
  keyed by `(creditSlug, fieldKey)` and `(creditSlug, slotKey)`. Mirrors U2 Q1=C precedent. The
  Excel verification-submittals worksheet (`docs/LEED_v4.1_SF_Verification_Submittals_Worksheet.xlsx`)
  drives the JSON content one-time; a small ad-hoc converter script is committed in `scripts/`
  for future re-runs.**
- B. Parse the .xlsx on every boot via `exceljs` (added in U3).
- C. Parse on-demand the first time a project's workbook is opened.

### Q2 — Workbook scope (auto-create vs. lazy-create)
- A. **Eager auto-create on attempted-toggle (US-4.1 explicit). When `ScorecardService.setPoints`
  flips `attempted=true` for an optional credit, a `WorkbookOrchestrator.materializeForCredit`
  call inserts empty `WorkbookFieldEntry` and `SubmittalSlot` rows from the catalog
  definitions. For prerequisites (`attempted` always true), materialization runs from
  `DemoSeeder.initFor(...)` and from `RegistrationOrchestrator` after a project is registered.**
- B. Lazy-create on first read.
- C. Materialize on demand from the FE.

### Q3 — Field Verification model
- A. **Generic key/value with type metadata. `WorkbookFieldDefinition` carries `fieldKey`,
  `label`, `dataType` (`text | integer | decimal | boolean | enum | date`), `unit`, `min`/`max`,
  `enumOptions`, `areaTag`, `displayOrder`, `helpText`. `WorkbookFieldEntry` stores
  `valueText`, `valueNumeric`, `valueBoolean`, `valueDate`, `valueEnum` — only the column
  matching the field's dataType is populated. Calculators are pure functions registered by
  `formulaKey` on the definition; the orchestrator runs `evaluate(formulaKey, scope)` whenever
  a contributing input changes.**
- B. Per-credit hand-coded TypeScript handlers.
- C. JSON-Logic / runtime expression engine.

### Q4 — Submittal storage seam (Q8 from original requirements)
- A. **`FileStorageProvider` interface; ship `LocalDiskStorageProvider` writing to
  `data/submittals/<projectId>/<creditId>/<slotKey>/<uuid>__<safeFileName>` under the BE root
  (gitignored). Provider exposes `put({ key, bytes, contentType, contentLength })` and
  `getSignedUrl(key, ttlSeconds)` returning `http://localhost:3000/api/v1/submittals/files/<token>`
  resolved by a controller endpoint that streams the file when the JWT-signed token is valid.**
- B. Inline base64 in the database (no provider).
- C. Real S3 with a localstack docker.

### Q5 — Allowed file types & size cap (US-4.3, FR-4.3)
- A. **Allowed MIME set: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, JPG/PNG/GIF/WEBP/HEIC,
  MP4/MOV/WEBM, TXT, MD. Size cap **25 MB** per file. Reject otherwise with `415` (mime) or
  `413` (size). Filename is sanitized (drop path separators, NFC-normalize, lowercase
  extension, `[^a-z0-9._-] → _`). The original filename is preserved in the DB for display.**
- B. Larger cap (100 MB) with chunked upload (deferred).
- C. Smaller cap (10 MB) for safety this build.

### Q6 — Three-column notes (US-4.4)
- A. **One row per `(creditId, projectId, column)` in `VerificationNote` — three columns
  identified by an enum `NoteColumn = GREEN_RATER | PROVIDER_QC | REVIEWER`. Each row has its
  own `body`, `savedByUserId`, `savedAt`, `version`. Per-column save endpoint:
  `PUT /projects/:id/workbook/:creditId/notes/:column`. Authorization rules: GREEN_RATER may
  write `GREEN_RATER` and `PROVIDER_QC` (Provider QC is the same persona doing QC for the
  Green Rater org per FR mapping); REVIEWER may write `REVIEWER`; Admin may write any. All
  three columns are read-by-everyone (Green Rater sees Reviewer column read-only).**
- B. One row per credit with three text columns and three timestamps.

### Q7 — Un-attempt behavior (US-4.1)
- A. **Soft-delete: setting `attempted = false` flips `WorkbookFieldEntry.archivedAt = NOW()`
  and `SubmittalSlot.archivedAt = NOW()` on every row for that credit (without deleting them).
  A subsequent re-attempt clears `archivedAt` on the existing rows so prior values come back
  (this is more user-friendly than the U2 scorecard's hard soft-clear). The FE confirmation
  prompt remains. Submittal files on disk are NOT deleted — the rows still hold the storageKey.**
- B. Hard-delete on un-attempt.
- C. Keep both — delete entries, archive submittals.

### Q8 — Frontend route shape (US-4.5)
- A. **A new lazy route `/projects/:projectId/workbook` lists all attempted credits with their
  three sections collapsible. The U2 view-tabs (`Field Verification`, `Submittals`, `Notes`)
  remain on the scorecard page but become enabled and switch to filtered modes that link
  through to the workbook. Section collapse state is persisted to `sessionStorage` keyed
  `gbci.workbook.collapse:${projectId}`. The U2 scorecard page also adds a "Open workbook"
  inline link on each attempted credit row.**
- B. Inline expand on the scorecard page (no separate route).

### Q9 — Calculator host (Q3=A implication)
- A. **Calculators live as pure modules in `src/workbook/calculators/`. A registry
  `formulaRegistry: Record<string, (scope) => unknown>` maps `formulaKey` → pure function. The
  workbook orchestrator runs the registered formula whenever a contributing input changes and
  persists the derived value into the corresponding `WorkbookFieldEntry`. Two formulas ship
  this build (one numeric sum + one threshold-based boolean) so the wiring is exercised; the
  rest are stubs that simply pass-through their input. PBT-01 target FL-6 (calculator
  determinism + idempotence).**
- B. No calculators this build (defer; only inputs).

### Q10 — Concurrency / state-lock interplay
- A. **Workbook writes call the existing `StateLockService.assertWritable(projectId)` (still a
  no-op until U5 lands the real check). Entry/note rows carry a `version` integer that
  increments on every persisted change (matches U2 Q13=A); not enforced this build.**
- B. Optimistic locking enforced now via `If-Match` headers.

---

## Approval gate

After your answers, I will (one wave):
1. Generate `aidlc-docs/construction/unit-4-workbook/functional-design/{domain-entities,
   business-rules, business-logic-model, frontend-components}.md`.
2. Generate `aidlc-docs/construction/plans/unit-4-workbook-code-generation-plan.md`.
3. Mark this batched plan checklist complete and update `aidlc-state.md`.

> Tests remain skipped per the U1 PBT deviation. PBT-01 (property identification) covers
> calculator determinism (FL-6), the eager-materialization idempotence on re-attempt (FL-7), and
> the file-key round-trip (FL-8).

---

## Part 2 generation checklist

- [ ] FD: `domain-entities.md` — WorkbookFieldDefinition, SubmittalSlotDefinition, WorkbookFieldEntry, SubmittalSlot, Submittal, VerificationNote, NoteColumn enum.
- [ ] FD: `business-rules.md` — BR-W (workbook), BR-S (submittals), BR-N (notes), BR-Z (state-lock & view-tabs activation), BR-X (auto-materialize on attempt).
- [ ] FD: `business-logic-model.md` — WorkbookOrchestrator (materialize / archive on un-attempt), submittal upload flow, note save flow, calculator evaluation, view-tab activation, PBT-01 properties.
- [ ] FD: `frontend-components.md` — Workbook page with three collapsible sections per attempted credit, file uploader, three-column notes editor, view-tabs activation, dto.ts/api-client.ts extensions.
- [ ] Plan: `unit-4-workbook-code-generation-plan.md` — numbered backend (catalog seeder + entities + orchestrator + storage provider + uploads + notes + view-tab wiring) + frontend + docs + validation steps; story coverage table.
- [ ] State: mark U4 FD ✅ in `aidlc-state.md`; NFR rows show `— (skipped per user)`.
- [ ] Audit: log this batched plan + the user's answers.
