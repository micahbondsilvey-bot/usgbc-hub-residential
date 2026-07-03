# Unit 4 — Frontend Components

Angular 20.2 standalone components. Decisions reflected: Q8=A new lazy route
`/projects/:projectId/workbook` plus enabling the U2 view-tabs as filters.

---

## Routes (added to `app.routes.ts`)

| Path | Auth | Component |
|---|---|---|
| `/projects/:projectId/workbook` | `authGuard` | `WorkbookPageComponent` |

The U2 scorecard route stays at `/projects/:projectId/scorecard`. The view-tabs on the
scorecard page (`Field Verification`, `Submittals`, `Notes`) flip from disabled-with-tooltip to
filtered-active.

---

## `features/workbook/` (new feature folder)

```
features/workbook/
├── workbook.store.ts                       // Signals — workbook tree, section-collapse, mutations
├── workbook-page.component.ts              // Top-level page; lists attempted credits with sections
├── credit-section/
│   ├── field-verification-section.component.ts
│   ├── submittals-section.component.ts
│   └── notes-section.component.ts
└── components/
    ├── file-uploader.component.ts          // drag-drop + multi-file slot variant
    ├── submittal-row.component.ts           // single uploaded file + delete + download
    └── three-column-notes.component.ts      // GR / Provider QC / Reviewer columns with per-column save
```

### `WorkbookStore` (Signals)
- `state: signal({ credits: WorkbookCreditDto[], loading, error, collapseByCreditId })`.
- `collapseByCreditId` is `{ [creditId]: { fields, submittals, notes } }` (each value `'open' |
  'collapsed'`); persisted to `sessionStorage` keyed `gbci.workbook.collapse:${projectId}`.
- Actions:
  - `loadWorkbook(projectId)`
  - `setFieldValue(creditId, fieldDefinitionId, value)` → calls
    `apiClient.setWorkbookField(...)`, refreshes affected credit on success.
  - `uploadSubmittal(creditId, slotKey, file)` → multipart POST.
  - `deleteSubmittal(submittalId)`.
  - `downloadSubmittal(submittalId)` → fetch signed URL then `window.open(url)`.
  - `saveNote(creditId, column, body)` → PUT with per-column save.
  - `toggleSection(creditId, section)` → flips collapse state.

### `WorkbookPageComponent` template (high level)
```text
<header>
  Workbook · <project name>
  link to /projects/:id/scorecard
</header>
<section *ngFor="credit of attemptedCredits">
  <credit-header (collapseAll/expandAll)>
  <field-verification-section [credit]="credit" />
  <submittals-section [credit]="credit" />
  <notes-section [credit]="credit" />
</section>
```

### `FieldVerificationSectionComponent`
- Renders area-tag groups within the credit. Each group is a `<mat-expansion-panel>`.
- One row per `WorkbookFieldDefinition`:
  - Non-derived numeric → `<mat-form-field>` with input, units suffix.
  - Boolean → `<mat-slide-toggle>`.
  - Enum → `<mat-select>` with `enumOptions`.
  - Date → `<mat-datepicker>`.
  - Derived → read-only `<gbci-derived-value>` chip (no input).
- Range warnings render as a small icon + tooltip next to the input.

### `SubmittalsSectionComponent`
- One block per `SubmittalSlot` showing the slot's `label` and `requirementNote`.
- For each slot:
  - If single-upload + a file is present → `<gbci-submittal-row>` (filename, size, uploaded-at,
    download/delete buttons).
  - If multi-upload → list of `<gbci-submittal-row>` plus an "Add another" button.
  - If empty → `<gbci-file-uploader>` drag-drop zone.

### `ThreeColumnNotesComponent`
- Three side-by-side columns. Each carries:
  - A header (Green Rater / Provider QC / Reviewer).
  - A `<textarea>` (read-only when the actor lacks write permission).
  - "Save" button (per-column).
  - "Last saved by NAME at TIMESTAMP" footer.
- The `actorRole` signal drives the read-only / writable state per column (mirrors BR-WN2).

---

## Section collapse persistence (US-4.5)

Each credit/section pair has its own collapse state. The store persists the entire
`collapseByCreditId` map to `sessionStorage` under `gbci.workbook.collapse:${projectId}`. On
mount, the store hydrates from sessionStorage. The state is preserved across navigation within
the workbook session (matches US-4.5 explicit AC).

---

## U2 scorecard view-tabs activation

The U2 `<gbci-scorecard-view-tabs>` component:
- Reads a new signal `workbookFlags: WorkbookFlagsDto | null` from a sibling store (or the
  scorecard store consumes it via a small extension).
- Removes the disabled / tooltip from the three previously-locked tabs.
- When a tab is selected (other than `All`), the component filters the rendered category-row
  list using `workbookFlags`:
  - `Field Verification` → only credits with `hasFieldEntries`
  - `Submittals` → only credits with `hasSubmittals`
  - `Notes` → only credits with `hasNotes`
- Each filtered row gets an inline `Open workbook ↗` link to
  `/projects/:id/workbook#credit-:creditId`.

The change in U2 is small: the view-tabs component takes a `flags` input; the scorecard store
adds `loadWorkbookFlags(projectId)` that calls `apiClient.getWorkbookFlags(projectId)`.

---

## Shared types extensions (`core/api/dto.ts`)

```ts
// Workbook
export type NoteColumn = 'GREEN_RATER' | 'PROVIDER_QC' | 'REVIEWER';
export type WorkbookFieldDataType = 'text' | 'integer' | 'decimal' | 'boolean' | 'enum' | 'date';

export interface WorkbookFieldDefinitionDto {
  id: string;
  creditId: string;
  fieldKey: string;
  label: string;
  helpText: string | null;
  dataType: WorkbookFieldDataType;
  unit: string | null;
  min: number | null;
  max: number | null;
  enumOptions: string[] | null;
  areaTag: string | null;
  displayOrder: number;
  formulaKey: string | null;
  required: boolean;
}

export interface WorkbookFieldEntryDto {
  id: string;
  fieldDefinitionId: string;
  creditId: string;
  valueText: string | null;
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  valueDate: string | null;   // ISO yyyy-mm-dd
  valueEnum: string | null;
  derived: boolean;
  archivedAt: string | null;
  version: number;
}

export interface SubmittalSlotDefinitionDto {
  id: string;
  creditId: string;
  slotKey: string;
  label: string;
  requirementNote: string | null;
  displayOrder: number;
  required: boolean;
  multiUpload: boolean;
}

export interface SubmittalDto {
  id: string;
  slotId: string;
  projectId: string;
  creditId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByUserId: string;
}

export interface SubmittalSlotDto {
  id: string;
  slotDefinitionId: string;
  creditId: string;
  archivedAt: string | null;
  submittals: SubmittalDto[];
}

export interface VerificationNoteDto {
  id: string | null;        // null when row not yet persisted
  creditId: string;
  column: NoteColumn;
  body: string | null;
  savedByUserId: string | null;
  savedByName: string | null;
  savedAt: string | null;
  version: number;
}

export interface WorkbookCreditDto {
  creditId: string;
  creditSlug: string;
  creditName: string;
  fieldDefinitions: WorkbookFieldDefinitionDto[];
  fieldEntries: WorkbookFieldEntryDto[];
  slotDefinitions: SubmittalSlotDefinitionDto[];
  slots: SubmittalSlotDto[];
  notes: VerificationNoteDto[];      // always 3 entries (one per column)
}

export interface WorkbookDto {
  projectId: string;
  credits: WorkbookCreditDto[];
}

export interface WorkbookFlagsDto {
  projectId: string;
  flags: {
    [creditId: string]: {
      hasFieldEntries: boolean;
      hasSubmittals: boolean;
      hasNotes: boolean;
    };
  };
}

export interface SetWorkbookFieldDto {
  fieldDefinitionId: string;
  valueText?: string | null;
  valueNumeric?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  valueEnum?: string | null;
}

export interface SetWorkbookFieldResponseDto {
  entry: WorkbookFieldEntryDto;
  warnings: { fieldDefinitionId: string; reason: string; value: number; allowedMin: number | null; allowedMax: number | null }[];
}

export interface SignedDownloadUrlDto {
  url: string;
  expiresAt: string;
}
```

---

## API client extensions (`core/api/api-client.ts`)

```ts
// --- Workbook (Unit 4) ----------------------------------------------------
getWorkbook(projectId: string): Observable<WorkbookDto>;
getWorkbookFlags(projectId: string): Observable<WorkbookFlagsDto>;
setWorkbookField(projectId: string, creditId: string, body: SetWorkbookFieldDto): Observable<SetWorkbookFieldResponseDto>;
uploadSubmittal(projectId: string, creditId: string, slotKey: string, file: File): Observable<SubmittalDto>;
deleteSubmittal(projectId: string, submittalId: string): Observable<void>;
getSignedSubmittalUrl(projectId: string, submittalId: string): Observable<SignedDownloadUrlDto>;
saveVerificationNote(projectId: string, creditId: string, column: NoteColumn, body: string | null): Observable<VerificationNoteDto>;
```

---

## Accessibility (WCAG 2.1 AA carry-over)

- Each section has an explicit `<h2>`/`<h3>` heading; collapse buttons are real `<button>` with
  `aria-expanded`.
- Three-column notes columns use `<section aria-labelledby>` and have keyboard-reachable Save
  buttons.
- File uploader supports keyboard drag-drop and labels its hidden `<input type="file">` with
  `aria-describedby` pointing at the requirement note text.
- Range warnings are surfaced through tooltips AND inline text (color is never the sole
  indicator).
