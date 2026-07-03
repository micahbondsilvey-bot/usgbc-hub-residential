# Unit 4 — Business Rules

Decision rules, validation, and constraints for the Workbook (Field Verification, Submittals,
Notes). Technology-agnostic.

## Workbook catalog (BR-WC)

### BR-WC1 Catalog source of truth
- The workbook catalog is loaded from `scripts/seed/leed-v41-sf-workbook.json` by
  `WorkbookCatalogSeeder` running `OnModuleInit` after the U2 catalog seeder (Q1=A).
- One-time conversion from the LEED v4.1 SF Verification Submittals Worksheet
  (`docs/LEED_v4.1_SF_Verification_Submittals_Worksheet.xlsx`) into the JSON shape; a small
  ad-hoc converter script is committed under `scripts/` for re-runs.

### BR-WC2 Idempotent seeding
- The seeder upserts `WorkbookFieldDefinition` and `SubmittalSlotDefinition` rows by their
  composite stable keys (`(creditId, fieldKey)` and `(creditId, slotKey)` respectively).
- Re-running must update `label`, `helpText`, `min/max`, `enumOptions`, `requirementNote`,
  `displayOrder`, and `formulaKey` if they have changed; never duplicate.
- Audit fields are populated via `AuditStampHelper.stampSystemInsert/Update` — same pattern as
  U2 catalog seeder (BR-C2).

### BR-WC3 Catalog integrity
- A definition's `creditId` MUST resolve to a credit in the seeded LEED v4.1 SF rating system.
  The seeder fail-fasts on unknown credits (mirrors BR-C3 from U2).
- For every `WorkbookFieldDefinition`:
  - `dataType = 'enum'` ⇒ `enumOptions` non-empty.
  - `dataType ∈ { 'integer', 'decimal' }` AND both `min`/`max` set ⇒ `min <= max`.
  - `formulaKey != null` ⇒ key MUST exist in `formulaRegistry` at boot. Seeder fail-fasts on
    unknown keys.
- For every `SubmittalSlotDefinition`: `(creditId, slotKey)` is unique within the JSON.

---

## Workbook materialization (BR-WX)

### BR-WX1 Eager materialization on attempted-toggle (US-4.1)
- When `ScorecardService.toggleAttempted(projectId, creditId, true, actor)` flips a credit to
  `attempted = true` (or `setPoints(...)` does the same), the orchestrator notifies
  `WorkbookOrchestrator.materializeForCredit(projectId, creditId, actor)`.
- The orchestrator reads the catalog definitions for that credit and inserts:
  - One empty `WorkbookFieldEntry` per `WorkbookFieldDefinition` (all value columns null;
    `derived = (formulaKey != null)`; `archivedAt = null`).
  - One empty `SubmittalSlot` per `SubmittalSlotDefinition` (`archivedAt = null`).
- Idempotent: if a row already exists for `(projectId, fieldDefinitionId)` or
  `(projectId, slotDefinitionId)`:
  - If `archivedAt` is set, clear it (re-attempt path; preserves prior values per BR-WX3).
  - Otherwise, no-op.
- For prerequisites, materialization is triggered from the U2 `ScorecardService.initFor(...)`
  on first scorecard creation and from `RegistrationOrchestrator` after registration completes
  (defensive — `initFor` is the primary path).

### BR-WX2 Hook coupling (no circular module dep)
- A neutral `WorkbookAttemptHookRegistry` lives in `src/common/hooks/`. ScorecardService
  injects it and calls `registry.notify({ projectId, creditId, attempted, actor })` whenever
  `attempted` materially changes. WorkbookOrchestrator registers itself on `OnModuleInit`.
- The registry tolerates listener exceptions: a thrown listener is logged and the user-facing
  scorecard write still succeeds. (Materialization is an enrichment, not a precondition.)

### BR-WX3 Soft-archive on un-attempt (Q7=A)
- `setPoints` / `toggleAttempted` flipping `attempted` to `false` triggers
  `WorkbookOrchestrator.archiveForCredit(projectId, creditId, actor)`:
  - Sets `archivedAt = NOW()` on every `WorkbookFieldEntry` for the credit.
  - Sets `archivedAt = NOW()` on every `SubmittalSlot` for the credit.
  - Does NOT touch `Submittal` (file) rows. Files remain on disk; the `SubmittalSlot.archivedAt`
    flag hides them from the active workbook view.
- Re-attempting the same credit (BR-WX1) clears `archivedAt` on those rows so prior values come
  back to the active view.

### BR-WX4 Authorization (writes)
- Workbook writes (field entries + submittals + notes) require an active project membership
  (`PROJECT_TEAM | GREEN_RATER | REVIEWER`) or Admin. Field entries are written by Project
  Team and Green Rater (writers of the Field Verification section). Submittals are uploaded
  by Project Team and Green Rater. Notes are gated by `BR-WN2`.
- All writes go through `StateLockService.assertWritable(projectId)` (the U2 stub). Unit 5
  will tighten this; U4 inherits the no-op.

---

## Field Verification (BR-WV)

### BR-WV1 One value column per dataType
- A `WorkbookFieldEntry` write puts the incoming value into the column matching the
  definition's `dataType`:
  - `text` → `valueText`
  - `integer` → `valueNumeric` (validated as integer in code)
  - `decimal` → `valueNumeric`
  - `boolean` → `valueBoolean`
  - `enum` → `valueEnum` (validated against `enumOptions`)
  - `date` → `valueDate`
- All other value columns are reset to null on every write.

### BR-WV2 Validation (override-friendly)
- For numerics, if `min` and/or `max` are set and the value is out-of-range:
  - The value IS persisted (no rejection) — matches U2 BR-S6 override-friendly precedent.
  - The response includes a `warnings` array entry of the form
    `{ fieldDefinitionId, reason: 'value_out_of_range', value, allowedMin, allowedMax }`.
- Hard rejections (400) only for: (a) wrong column for dataType, (b) enum value not in
  `enumOptions`, (c) non-finite numeric, (d) date that does not parse.

### BR-WV3 Calculator hook (Q9=A)
- After a non-derived field write succeeds, the orchestrator runs every derived field
  (`formulaKey != null`) on the same credit:
  - `scope = { entries: [...all WorkbookFieldEntry on this credit ...] }` (a typed map).
  - `value = formulaRegistry[formulaKey](scope)`.
  - The derived `WorkbookFieldEntry` is updated with the computed value and `derived = true`.
- Determinism (FL-6 PBT-01 target): for the same `scope`, the registry function is pure —
  same inputs ⇒ same output. Idempotence: running the registry twice on the same scope
  produces the same persisted value.
- Two formulas ship this build (one numeric sum, one threshold-boolean) so the wiring is
  exercised; unknown formulas fall back to a no-op pass-through.

### BR-WV4 Audit
- Field-entry writes are audit-stamped by the controller-level `AuditStampInterceptor`.
- A flip from null → value and value → null on a non-derived field also produces an explicit
  `AuditService.record` row (`entityType: 'WorkbookFieldEntry'`, before/after of the touched
  value column). Derived-field updates are NOT explicitly recorded — they are deterministic
  consequences of user input and the entity-level `version` already captures them.

---

## Submittals (BR-WS)

### BR-WS1 Upload flow
- `POST /projects/:projectId/workbook/credits/:creditId/slots/:slotKey/files` (multipart,
  field name `file`) uploads exactly one file:
  1. Resolve / lazy-create the `SubmittalSlot` row (BR-WX1 has likely already created it).
  2. Validate MIME + size (BR-WS3).
  3. Sanitize filename → `safeFileName`.
  4. Compute storage key: `submittals/<projectId>/<creditId>/<slotKey>/<uuid>__<safeFileName>`.
  5. Stream bytes to `FileStorageProvider.put(...)`.
  6. Insert a `Submittal` row referencing the slot.
  7. Return the `Submittal` DTO with `uploadedAt`.
- Multi-file slots (`multiUpload = true`) accept additional files; non-multi slots reject the
  second upload with `409 Conflict` ("slot already has a file; delete the existing one first").

### BR-WS2 Download flow
- `GET /projects/:projectId/workbook/files/:submittalId/url` returns
  `{ url, expiresAt }`. The URL is a short-lived JWT-signed token URL of the form
  `http://localhost:3000/api/v1/submittals/files/<token>`.
- The file-stream endpoint validates the token, resolves the storage key via the
  `FileStorageProvider`, and streams bytes with the appropriate `Content-Type` and
  `Content-Disposition: attachment; filename="..."` header (using the original filename).
- The token is bound to `(submittalId, actorUserId)` and expires in **5 minutes**.

### BR-WS3 Allowed file types & size cap (Q5=A)
- Allowed MIME set:
  - PDF (`application/pdf`)
  - Word (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
  - PowerPoint (`application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`)
  - Excel (`application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
  - Images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic`, `image/heif`)
  - Video (`video/mp4`, `video/quicktime`, `video/webm`)
  - Plain text (`text/plain`)
  - Markdown (`text/markdown`)
- Max file size: **25 MB** (`26 214 400` bytes). Reject `413` otherwise.
- Disallowed MIME → `415 Unsupported Media Type`.
- Filename sanitization:
  - Drop path separators (`/`, `\`).
  - NFC-normalize.
  - Lowercase the extension.
  - Replace `[^a-z0-9._-]` (case-insensitive) with `_`.
  - Cap to 200 characters.

### BR-WS4 Delete
- `DELETE /projects/:projectId/workbook/files/:submittalId` deletes a `Submittal` row AND
  the underlying file. Authorized for the uploader, any active project member with role
  `PROJECT_TEAM | GREEN_RATER`, or Admin. Reviewers cannot delete (they review evidence;
  removing it is a project-team action).
- Audit-recorded with `entityType = 'Submittal.deleted'`.

### BR-WS5 Storage provider seam (Q4=A)
- `FileStorageProvider`:
  - `put({ key, bytes, contentType, contentLength }): Promise<void>`
  - `get(key): Promise<Buffer | NodeJS.ReadableStream>`
  - `delete(key): Promise<void>`
- `LocalDiskStorageProvider` writes under `data/submittals/...` relative to the BE working
  directory; the directory is gitignored. Path traversal prevention: `key` is validated to
  match `/^submittals\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9_-]+\/[a-z0-9-_.]+$/i`.
- File-key round-trip property (FL-8 PBT-01 target): for any valid `(projectId, creditId,
  slotKey, originalFileName)`, `parseKey(buildKey(...)) === { projectId, creditId, slotKey,
  filename }`.

---

## Verification Notes (BR-WN)

### BR-WN1 Lazy row creation
- Reading the notes for a credit returns three rows (one per `NoteColumn`); when any row does
  not yet exist, an empty placeholder is returned (not persisted) so the FE can render three
  columns uniformly.
- The first write to a column lazy-inserts the row. Subsequent writes update it.

### BR-WN2 Per-column writers (Q6=A)
- Writers per column:
  - `GREEN_RATER` column: writable by **PROJECT_TEAM, GREEN_RATER, Admin**.
  - `PROVIDER_QC` column: writable by **GREEN_RATER, Admin** (Provider QC is the GR's QC role).
  - `REVIEWER` column: writable by **REVIEWER, Admin**.
- All three columns are READABLE by any active project member or Admin (US-4.4 explicit:
  Green Raters can READ the Reviewer column read-only).

### BR-WN3 Per-column save endpoint
- `PUT /projects/:projectId/workbook/credits/:creditId/notes/:column` with body
  `{ body: string | null }`. Sets `body`, `savedByUserId = actor.id`, `savedAt = NOW()`,
  increments `version`. Audit-stamped via the controller interceptor and an explicit
  `AuditService.record` row (`entityType = 'VerificationNote.${column}'`,
  before/after of the body — truncated to 240 chars).
- `body` length capped to **5000 characters**; longer rejected with `400`.

---

## View-tabs activation (BR-WT)

### BR-WT1 Activate the U2-disabled tabs (Q8=A, FR-4.6)
- The U2 scorecard FE renders four view-tabs: `All`, `Field Verification`, `Submittals`,
  `Notes`. U2 ships `All` enabled, the others disabled-with-tooltip.
- U4 enables the three remaining tabs. Each filtered tab displays only those scorecard rows
  whose credit is **attempted** AND has at least one populated entry of that section's type.
- The "populated" check uses cheap derived flags exposed by the workbook read endpoint:
  - `Field Verification`: at least one non-archived `WorkbookFieldEntry` for the credit has
    a non-null value.
  - `Submittals`: at least one non-archived `SubmittalSlot` for the credit has a non-archived
    `Submittal`.
  - `Notes`: at least one `VerificationNote` for the credit has a non-null `body`.
- Each filtered row carries an "Open workbook" link to `/projects/:id/workbook#credit-:creditId`.

---

## State-lock & forward-compat (BR-WZ)

### BR-WZ1 State-lock writes
- All workbook write paths call `StateLockService.assertWritable(projectId)`. The U2 stub
  no-ops; U5 will tighten when `Project.status = UNDER_REVIEW`.

### BR-WZ2 Concurrency
- Last-write-wins (matches U2 Q13=A). Every persisted change increments `version`. Not
  enforced this build.
