# Unit 4 — Domain Entities

Technology-agnostic domain model for the Workbook (Field Verification, Submittals, three-column
Notes). All persisted entities inherit `AuditBase` from Unit 1.

Decisions reflected (all-A from `unit-4-workbook-design-plan.md`):
- Q1=A hand-curated `leed-v41-sf-workbook.json` seeded by `WorkbookCatalogSeeder`.
- Q2=A eager auto-create on attempted-toggle.
- Q3=A generic key/value field model with `dataType` discriminator.
- Q4=A `FileStorageProvider` seam + `LocalDiskStorageProvider`.
- Q5=A 25 MB cap, broad MIME allowlist, sanitized filenames.
- Q6=A one row per `(creditId, projectId, NoteColumn)`.
- Q7=A soft-archive on un-attempt (preserves data for re-attempt).
- Q8=A new `/projects/:projectId/workbook` route.
- Q9=A pure-function calculator registry by `formulaKey`.
- Q10=A inherited state-lock + `version` last-write-wins.

---

## Catalog (definition) entities

These rows describe what fields and submittal slots a credit owns. Seeded once at boot from
`scripts/seed/leed-v41-sf-workbook.json` (BR-WC1).

### WorkbookFieldDefinition

Defines one Field Verification input for a credit.

- `id: UUID`
- `creditId: UUID` (FK → `Credit`, the U2 catalog row)
- `fieldKey: string` — stable identifier within the credit, e.g., `lt_compact_density_uph`.
- `label: string` — UI label.
- `helpText: string | null` — short tooltip text.
- `dataType: 'text' | 'integer' | 'decimal' | 'boolean' | 'enum' | 'date'`.
- `unit: string | null` — display unit for numerics, e.g., `units/acre`, `%`.
- `min: number | null` — for numerics, inclusive.
- `max: number | null` — for numerics, inclusive.
- `enumOptions: string[] | null` — only for `dataType = 'enum'`.
- `areaTag: string | null` — groups fields into UI sections, e.g., `'Site'`, `'Envelope'`,
  `'HVAC'`.
- `displayOrder: integer`.
- `formulaKey: string | null` — when set, this field is **derived**: the workbook orchestrator
  computes its value via `formulaRegistry[formulaKey](scope)` whenever a contributing input
  changes.
- `required: boolean` — UI hint only this build (writes never reject for missing fields; reviewer
  flags incomplete entries via the U5 review report).
- inherits `AuditBase`.

Constraints:
- `(creditId, fieldKey)` UNIQUE.
- `dataType = 'enum'` ⇒ `enumOptions` non-null and non-empty.
- `dataType ∈ { 'integer', 'decimal' }` ⇒ if both `min` and `max` set, `min <= max`.
- A derived field (`formulaKey != null`) MAY still have a `dataType` for display formatting.

### SubmittalSlotDefinition

Defines one named upload slot for a credit.

- `id: UUID`
- `creditId: UUID` (FK → `Credit`)
- `slotKey: string` — stable identifier within the credit.
- `label: string` — UI label, e.g., `"Compact development calculation"`.
- `requirementNote: string | null` — short description shown next to the slot.
- `displayOrder: integer`.
- `required: boolean` — UI hint; submission gating in U5.
- `multiUpload: boolean` — when `true`, the slot accepts more than one file (e.g., photo
  evidence). Default `false`.
- inherits `AuditBase`.

Constraints:
- `(creditId, slotKey)` UNIQUE.

---

## Per-project (instance) entities

These rows are owned by a project; they're materialized lazily-then-eagerly per BR-WX1 (eager
auto-create on attempted-toggle).

### WorkbookFieldEntry

A project's value for one `WorkbookFieldDefinition`.

- `id: UUID`
- `projectId: UUID` — soft FK forward-declared, matches U2/U3 patterns.
- `creditId: UUID` (FK → `Credit`)
- `fieldDefinitionId: UUID` (FK → `WorkbookFieldDefinition`)
- `valueText: text | null`
- `valueNumeric: numeric(18,6) | null`
- `valueBoolean: boolean | null`
- `valueDate: date | null`
- `valueEnum: varchar(64) | null`
- `derived: boolean` — `true` when this value was set by a calculator (`formulaKey != null`);
  `false` when set by a user input.
- `archivedAt: timestamptz | null` — soft-archive marker (BR-WX3 un-attempt).
- `version: integer` — increments on every persisted change.
- inherits `AuditBase`.

Constraints / invariants:
- `(projectId, fieldDefinitionId)` UNIQUE.
- Exactly one of the value columns is populated for a non-null entry; for `dataType='boolean'`,
  `valueBoolean` is the column; etc. The orchestrator enforces this.
- Numeric range checks happen at the application layer (BR-WV2); out-of-range values are still
  persisted and surfaced via warnings (matches U2 BR-S6 override-friendly precedent).

### SubmittalSlot

A project's instance of a `SubmittalSlotDefinition`. Multiple `Submittal` (file) rows hang off
this when the slot is multi-upload.

- `id: UUID`
- `projectId: UUID`
- `creditId: UUID` (FK → `Credit`)
- `slotDefinitionId: UUID` (FK → `SubmittalSlotDefinition`)
- `archivedAt: timestamptz | null` — soft-archive marker (BR-WX3 un-attempt).
- `version: integer`.
- inherits `AuditBase`.

Constraints:
- `(projectId, slotDefinitionId)` UNIQUE.

### Submittal

One uploaded file in a slot. Multi-file slots (e.g., photo evidence) carry multiple `Submittal`
rows under a single `SubmittalSlot`.

- `id: UUID`
- `slotId: UUID` (FK → `SubmittalSlot`)
- `projectId: UUID` — denormalized for query convenience.
- `creditId: UUID` — denormalized for query convenience.
- `originalFileName: string` — preserved for display.
- `safeFileName: string` — sanitized version actually used on disk.
- `mimeType: string` — validated against the allowlist (BR-WS3).
- `sizeBytes: integer` — validated against 25 MB cap (BR-WS3).
- `storageKey: string` — opaque path the `FileStorageProvider` uses to retrieve the bytes.
  For the local provider, this is `submittals/<projectId>/<creditId>/<slotKey>/<uuid>__<safeFileName>`.
- `uploadedByUserId: UUID` — actor.
- `uploadedAt: timestamptz` — saves the time/date stamp required by US-4.3 / FR-4.3.
- `archivedAt: timestamptz | null` — preserved across un-attempt (BR-WX3 keeps file rows; only
  `SubmittalSlot.archivedAt` toggles).
- inherits `AuditBase`.

Constraints:
- `mimeType` ∈ allowlist (BR-WS3); `sizeBytes` ∈ [1, 26214400].
- `safeFileName` matches `/^[a-z0-9._-]+$/i`.

### VerificationNote

The 3-column notes per credit, per project (BR-WN1..BR-WN3). One row per
`(projectId, creditId, column)`.

- `id: UUID`
- `projectId: UUID`
- `creditId: UUID` (FK → `Credit`)
- `column: NoteColumn` enum (`GREEN_RATER | PROVIDER_QC | REVIEWER`).
- `body: text | null` — null = "never saved"; empty string = "explicitly cleared".
- `savedByUserId: UUID | null` — actor of the last save (null on never-saved rows).
- `savedAt: timestamptz | null` — last-save timestamp; surfaces directly on the FE.
- `version: integer` — increments on every persisted change.
- inherits `AuditBase`.

Constraints:
- `(projectId, creditId, column)` UNIQUE.
- A row is created lazily on first read OR on first write, whichever happens first
  (BR-WN1 Lazy creation). Eager materialization is NOT performed for notes — they're cheap to
  create on demand and almost all credits will leave them empty.

---

## Enums (definitive)

```ts
export enum NoteColumn {
  GREEN_RATER = 'GREEN_RATER',
  PROVIDER_QC = 'PROVIDER_QC',
  REVIEWER = 'REVIEWER',
}

export enum WorkbookFieldDataType {
  TEXT = 'text',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  DATE = 'date',
}
```

---

## Relationships (text)

```
Credit (U2) 1 ── * WorkbookFieldDefinition 1 ── * WorkbookFieldEntry
            1 ── * SubmittalSlotDefinition 1 ── * SubmittalSlot 1 ── * Submittal
            1 ── * VerificationNote (one per (projectId, creditId, column))

Project (U3) 1 ── * WorkbookFieldEntry / SubmittalSlot / Submittal / VerificationNote
```

---

## Out of scope (this unit)

- Real S3 — `LocalDiskStorageProvider` ships now; the seam is the contract.
- Submission gating — required-flag is informational; review-time gating lands in U5.
- Per-credit verification report — auto-generated review report belongs to U5.
- Workbook history / change log beyond `version` and `audit_log` rows on transitions.
