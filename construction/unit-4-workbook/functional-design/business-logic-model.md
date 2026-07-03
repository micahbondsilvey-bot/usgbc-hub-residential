# Unit 4 — Business Logic Model

End-to-end orchestration for the Workbook (Field Verification, Submittals, three-column Notes).
Tech-agnostic narratives + the property-based-testing (PBT-01) targets.

---

## BL-1 WorkbookOrchestrator — `materializeForCredit(...)` (US-4.1, BR-WX1)

Triggered by the `WorkbookAttemptHookRegistry` when `ScorecardService.toggleAttempted(...)`
or `setPoints({attempted:true})` flips `attempted` to `true`.

```text
1. fieldDefs   = WorkbookFieldDefinition.find({ creditId })
2. slotDefs    = SubmittalSlotDefinition.find({ creditId })
3. existingF   = WorkbookFieldEntry.find({ projectId, fieldDefinitionId IN fieldDefs.ids })
4. existingS   = SubmittalSlot.find({ projectId, slotDefinitionId IN slotDefs.ids })
5. For each fieldDef:
   a. row = existingF.findFor(fieldDef)
   b. if row && row.archivedAt → clear archivedAt (re-attempt path); save.
   c. else if !row → create empty row (all values null; derived = (formulaKey != null)); save.
   d. else → no-op.
6. For each slotDef:
   a. row = existingS.findFor(slotDef)
   b. if row && row.archivedAt → clear archivedAt; save.
   c. else if !row → create empty SubmittalSlot; save.
   d. else → no-op.
7. AuditService.record (Workbook.materialized, after = { fieldRows: N, slotRows: M }).
```

Failure modes:
- Listener exception is logged + swallowed by the registry — the user-facing scorecard write
  still succeeds.

Idempotence (FL-7 PBT-01 target): for any sequence of materializeForCredit calls with the
same `(projectId, creditId)`, the final row set is the same as a single call.

---

## BL-2 WorkbookOrchestrator — `archiveForCredit(...)` (US-4.1, BR-WX3)

Triggered when `attempted` flips to `false`.

```text
1. WorkbookFieldEntry.update({ projectId, creditId, archivedAt: null }, { archivedAt: NOW() }).
2. SubmittalSlot.update({ projectId, creditId, archivedAt: null }, { archivedAt: NOW() }).
3. AuditService.record (Workbook.archived).
```

`Submittal` (file) rows are NOT touched. Files remain on disk; the slot's `archivedAt`
hides them from the active workbook view.

---

## BL-3 WorkbookService — read paths

### Get the workbook for a project
```text
1. assertReader(projectId, actor)
2. attemptedCredits = ScorecardEntry.find({ projectId, attempted: true }).map(creditId)
3. For each credit:
   a. fieldEntries = WorkbookFieldEntry.find({ projectId, creditId, archivedAt: null }) joined to definitions
   b. slots       = SubmittalSlot.find({ projectId, creditId, archivedAt: null }) joined to definitions and submittals
   c. notes       = three-column lazy-load (BR-WN1)
4. Return { credits: [{ creditId, fieldEntries, slots, notes }] }
5. The shape includes the `derivedFlags` used by view-tab activation (BR-WT1):
   { hasFieldEntries, hasSubmittals, hasNotes }
```

### Get a single credit's section
- `GET /projects/:id/workbook/credits/:creditId/fields|submittals|notes` — same as above
  scoped to one credit; used by the FE to refresh after edits without reloading the whole
  workbook.

---

## BL-4 WorkbookService — write field entry (BR-WV1..BR-WV4)

```text
1. assertWriter(projectId, actor) — Project Team / Green Rater / Admin.
2. assertWritable(projectId)       — state-lock stub.
3. fieldDef = WorkbookFieldDefinition.findById(fieldDefinitionId)
4. coerce + validate body.value into the column matching fieldDef.dataType (BR-WV1).
5. If derived (formulaKey != null) and the actor is not Admin → 403
   (derived fields are computed; users may not set them directly).
6. Save the entry; reset other value columns to null; bump version.
7. Audit: stampUpdate + AuditService.record on null-flip transitions.
8. Run all derived fields on this credit (BR-WV3):
   scope = { entries: [...all WorkbookFieldEntry on this credit ...] }
   For each derivedField: value = formulaRegistry[formulaKey](scope); save.
9. Return { entry, warnings: [...range warnings if any...] }
```

---

## BL-5 SubmittalsOrchestrator — upload (BR-WS1..BR-WS5)

```text
1. assertWriter (Project Team / Green Rater / Admin); assertWritable.
2. slotDef = SubmittalSlotDefinition.find({ creditId, slotKey })
3. slot    = SubmittalSlot.findOrCreate({ projectId, slotDefinitionId: slotDef.id }, archivedAt: null)
4. If !slotDef.multiUpload AND slot has a non-archived Submittal → 409 Conflict.
5. Validate MIME (BR-WS3) and size (≤ 25 MB) → otherwise 415 / 413.
6. safeFileName = sanitize(originalFileName).
7. storageKey   = `submittals/${projectId}/${creditId}/${slotKey}/${uuid}__${safeFileName}`.
8. provider.put({ key: storageKey, bytes, contentType, contentLength }).
9. submittal = Submittal.insert({ slotId, projectId, creditId, originalFileName, safeFileName,
                                  mimeType, sizeBytes, storageKey, uploadedAt: NOW(),
                                  uploadedByUserId: actor.id })
10. AuditService.record (Submittal.uploaded; after = { storageKey, sizeBytes, mimeType }).
11. Return SubmittalDto.
```

Failure path: if step 9 (DB insert) throws, the orchestrator best-efforts a `provider.delete(storageKey)` so the disk doesn't accumulate orphans.

---

## BL-6 Signed-URL flow (BR-WS2)

```text
1. GET /projects/:id/workbook/files/:submittalId/url
   - assertReader; load Submittal; ensure it belongs to projectId.
   - token = sign({ submittalId, actorUserId, exp: NOW() + 5m }, JWT secret).
   - Return { url: `${apiBase}/submittals/files/${token}`, expiresAt: NOW() + 5m }.

2. GET /api/v1/submittals/files/:token  (public — token contains its own auth)
   - verify(token) → { submittalId, actorUserId, exp }.
   - load submittal; resolve storageKey; provider.get(storageKey) → stream/buffer.
   - Send with Content-Type: submittal.mimeType
            and Content-Disposition: attachment; filename="<originalFileName>".
```

---

## BL-7 Notes — per-column save (BR-WN1..BR-WN3)

```text
1. assertWriter(projectId, actor, column):
   - column == GREEN_RATER → require PROJECT_TEAM | GREEN_RATER | Admin.
   - column == PROVIDER_QC → require GREEN_RATER | Admin.
   - column == REVIEWER    → require REVIEWER | Admin.
2. assertWritable(projectId).
3. row = VerificationNote.findOrCreate({ projectId, creditId, column })
4. before = { body: row.body }
5. row.body = body; row.savedByUserId = actor.id; row.savedAt = NOW(); row.version++;
6. save + audit-stamp + AuditService.record (entityType='VerificationNote.${column}', before/after truncated to 240 chars).
7. Return VerificationNoteDto.
```

---

## BL-8 View-tab activation (BR-WT1)

The U2 scorecard summary endpoint is extended (or augmented by a sibling) to return a
`workbookFlags: { creditId → { hasFieldEntries, hasSubmittals, hasNotes } }` map. The FE
view-tabs use it to filter rows.

Implementation:
- `WorkbookFlagsService.getFlags(projectId)` runs three lightweight queries:
  - `SELECT credit_id FROM workbook_field_entry WHERE project_id = $1 AND archived_at IS NULL AND (value_text IS NOT NULL OR value_numeric IS NOT NULL OR value_boolean IS NOT NULL OR value_date IS NOT NULL OR value_enum IS NOT NULL) GROUP BY credit_id`
  - `SELECT s.credit_id FROM submittal s JOIN submittal_slot ss ON s.slot_id = ss.id WHERE s.project_id = $1 AND s.archived_at IS NULL AND ss.archived_at IS NULL GROUP BY s.credit_id`
  - `SELECT credit_id FROM verification_note WHERE project_id = $1 AND body IS NOT NULL AND body <> '' GROUP BY credit_id`
- Combined into one DTO returned via `GET /projects/:id/workbook/flags`. Cache TTL 0
  (computed per-request — small project rows, fast queries).

---

## BL-9 Catalog seeder (BR-WC1..BR-WC3)

```text
1. Read scripts/seed/leed-v41-sf-workbook.json
2. Validate seed invariants:
   - For each credit entry: credit slug exists in U2 catalog.
   - For each field def: dataType valid; enum/range invariants hold; formulaKey ∈ formulaRegistry.
   - For each slot def: slotKey unique within credit.
3. Upsert WorkbookFieldDefinition rows by (creditId, fieldKey).
4. Upsert SubmittalSlotDefinition rows by (creditId, slotKey).
5. AuditStampHelper.stampSystem* on every row.
6. Log "Workbook catalog seeded — N field defs, M slot defs across K credits".
```

The seed JSON for the demo build covers a modest subset of credits to exercise the wiring;
adding more credits is data-only.

---

## BL-10 Demo seed bridge

`WorkbookDemoSeeder` runs after `ScorecardModule.DemoSeeder` and `WorkbookCatalogSeeder`. For
the demo project:
- Calls `WorkbookOrchestrator.materializeForCredit` for every attempted credit on the demo
  scorecard (idempotent).
- Pre-populates one or two field entries and one submittal stub per ~3 demo credits so the
  FE workbook view has something to render. Files are seeded into `data/submittals/...` from
  small fixture buffers checked into `scripts/seed/fixtures/`.
- Three-column notes seeded for one credit so the notes UI renders with content.

---

## Testable Properties (PBT-01)

Three properties identified for U4. **Tests are NOT generated this build per the documented
PBT deviation**, but the pure modules below are coded so they're test-friendly (no Nest
imports, deterministic).

### FL-6 Calculator registry — determinism + idempotence
- For all `(formulaKey, scope)`: `formulaRegistry[formulaKey](scope)` is deterministic — same
  inputs ⇒ same output.
- For all derived field updates: running BR-WV3 twice in a row on the same scope persists the
  same value (no oscillation).

### FL-7 materializeForCredit idempotence
- For all `(projectId, creditId, fieldDefs, slotDefs)`: applying `materializeForCredit` N
  times yields the same `WorkbookFieldEntry` + `SubmittalSlot` row set as applying it once.
- Re-attempt path: an archived row that gets `materializeForCredit` clears `archivedAt`
  exactly once per call (no version churn beyond +1).

### FL-8 File-key round-trip
- For all `(projectId, creditId, slotKey, safeFileName)`:
  `parseKey(buildKey(projectId, creditId, slotKey, uuid, safeFileName))` returns the same
  `{ projectId, creditId, slotKey, uuid, safeFileName }`.
- The build/parse helpers are pure and live in `src/workbook/storage/key.utils.ts`.

> Three properties. Test pass deferred per documented U1 PBT deviation; pure subjects
> implemented.

---

## Cross-cutting touchpoints (no new infra)

| Concern | Where it's handled |
|---|---|
| Audit timestamps | Inherited from U1 (`AuditStampInterceptor` + `AuditStampHelper`) |
| Audit log rows | `AuditService.record` on materialize/archive/upload/delete + note saves + non-derived field flips |
| Throttling | Inherited; per-route limits added on uploads (`@Throttle(20, 60)` for uploads) |
| Auth & RBAC | `JwtAuthGuard` global + `ProjectRolesGuard` on `/projects/:id/workbook/*` and uploads |
| Notifications | Not used in U4 (review-time notifications belong to U5/U7) |
| FE state | Signal-based `WorkbookStore` per project; section-collapse state in `sessionStorage` |
