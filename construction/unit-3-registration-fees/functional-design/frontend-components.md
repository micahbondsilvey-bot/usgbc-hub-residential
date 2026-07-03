# Unit 3 — Frontend Components

Angular 20.2 standalone components, lazy-loaded by route, state via Signals, calling the typed
`ApiClient`. Decisions reflected: Q8=A `mat-stepper` wizard at `/projects/register`,
sessionStorage-backed `RegistrationStore`, separate `/projects/:projectId/edit` reuses the same
step components in "edit mode".

---

## Routes (added to `app.routes.ts`)

| Path | Auth | Guard | Component |
|---|---|---|---|
| `/projects` | required | `authGuard` | `ProjectsListPageComponent` (mine + admin-all) |
| `/projects/register` | required | `authGuard` | `RegistrationPageComponent` (mode=`register`) |
| `/projects/:projectId/edit` | required | `authGuard` + `projectRoleGuard` (`['*']`) | `RegistrationPageComponent` (mode=`edit`) |
| `/projects/:projectId` | required | `authGuard` + `projectRoleGuard` (`['*']`) | `ProjectDetailPageComponent` |
| `/projects/bulk` | required | `authGuard` | `BulkUploadPageComponent` |

The existing `/projects/:projectId/scorecard` route from U2 is unchanged.

---

## `features/registration/` (new feature folder)

```
features/registration/
├── registration.store.ts                 // Signals store — wizard state + sessionStorage
├── registration-page/
│   └── registration-page.component.ts    // <mat-stepper> hosting the 8 steps
├── steps/
│   ├── rating-system-step.component.ts   // Step 1: rating system + membership level
│   ├── project-details-step.component.ts // Step 2: name, building type, units, gross area
│   ├── building-info-step.component.ts   // Step 3: target cert level, optional notes
│   ├── owner-info-step.component.ts      // Step 4: owner name/email/phone/org
│   ├── address-step.component.ts         // Step 5: address + lat/lng
│   ├── agreement-step.component.ts       // Step 6: click-through with rendered text
│   ├── fees-payment-step.component.ts    // Step 7: live FeeQuote + PAY_NOW / PAY_LATER toggle
│   └── confirmation-step.component.ts    // Step 8: GBCI display ID + invoice + agreement view
├── components/
│   ├── fee-quote-card.component.ts
│   ├── invoice-summary-card.component.ts
│   ├── agreement-modal.component.ts
│   └── address-fields.component.ts       // shared with edit-mode + bulk template hint
└── fee-calculator.client.ts              // FE mirror of backend pure FeeCalculator
```

### `RegistrationStore` (Signals)
- `state: signal({ mode: 'register' | 'edit', stepIndex, draft: DraftPayload, feeQuote,
  invoice?, errors })`.
- `persistKey = 'draft:registration:${userId}'` in `sessionStorage` — restored on construction,
  cleared on successful registration.
- Computed signals: `isStepValid(stepIndex)`, `canFinalize()` (all required fields present per
  BR-P2), `effectiveCurrencyDisplay` (USD this build).
- Actions: `setRatingSystem`, `setMembershipLevel`, `setProjectFields`, `setOwner`, `setAddress`,
  `signAgreement`, `setPaymentChoice`, `requestFeeQuote`, `submit()`.

### Step components
Each step is a standalone component that:
- Receives `store: RegistrationStore` via DI.
- Owns its own form group (Reactive Forms) bound to the relevant slice of `store.state`.
- Validates locally on submit; surfaces server errors when they come back.

### Confirmation step
Renders the result of `submit()`:
- `Project.gbciDisplayId` prominently.
- Embedded `<gbci-invoice-summary-card>` (download placeholder — JSON for now; PDF in Unit 7).
- Embedded `<gbci-agreement-modal>` opener showing rendered agreement text + signedByName + date.
- "Go to scorecard" link to `/projects/${id}/scorecard`.

### Fee quote card
Live recompute via `requestFeeQuote()` whenever the user changes `ratingSystemSlug` or
`membershipLevel`. Shows the computed `amountCents` (formatted USD), single line item, and a
small note explaining the membership level chosen.

### Edit mode (US-2.5)
Same `RegistrationPageComponent` but bound to an existing `Project` payload (loaded by the
router via `:projectId`). The wizard becomes a single Material tabbed-form with all fields
visible; **fee-related fields (membership level) are disabled** with a tooltip — BR-P5.

---

## `features/projects/` (new feature folder)

```
features/projects/
├── projects-list-page/
│   └── projects-list-page.component.ts   // /projects
└── project-detail-page/
    └── project-detail-page.component.ts  // /projects/:projectId
```

`ProjectsListPageComponent` shows a Material table with `gbciDisplayId`, `name`,
`status`, `targetCertificationLevel`, and a "Open" link to detail. Admin sees all projects;
others see projects where they're an active member.

`ProjectDetailPageComponent` shows:
- Editable `project-info-panel` (replaces the U2 read-only one).
- Quick links to Scorecard (`/projects/:id/scorecard`) and Edit (`/projects/:id/edit`).
- "Withdraw project" button (Project Team or Admin only — visibility gated by `MeRoleDto`).

---

## `features/bulk/` (new feature folder)

```
features/bulk/
├── bulk-upload-page/
│   └── bulk-upload-page.component.ts     // /projects/bulk
├── components/
│   ├── upload-dropzone.component.ts
│   ├── per-row-result-table.component.ts
│   └── template-help-card.component.ts   // explains the external_row_id key
└── bulk.store.ts
```

### `BulkStore`
- Tracks `currentBatch: BulkRegistrationBatchDto | null`, `perRowOutcomes: BulkRowDto[]`,
  `uploading: boolean`, `lastError: string | null`.
- Calls `apiClient.uploadBulkRegistration(file)`; on response, populates outcomes.

### Behavior
- Single drag-and-drop area for `.xlsx`/`.xls`.
- Client-side validation: file size ≤ 2 MB, row count probed via header read.
- Server-side response renders per-row table with `external_row_id`, status, error message,
  and `gbciDisplayId` (when CREATED).
- "Re-upload corrected sheet" button just opens the file picker again — the orchestrator
  handles idempotency (BR-B3).

---

## Editable `project-info-panel` (U2 → U3 migration)

The U2 read-only `ProjectInfoPanelComponent` becomes editable in U3. The change:
- Lives at the same path: `features/scorecard/components/project-info-panel/`.
- New `mode` input: `'readonly' | 'editable'`.
- In `editable`, the panel becomes a small inline form (project name, target level, owner email).
  Save calls `apiClient.patchProject(projectId, partial)`.
- On the scorecard page, the panel uses `editable` when the caller has any project role; on
  the project list/detail page it can stay editable.

---

## `features/auth/` extension — invite UI (US-2.6)

The U1 backend already supports `POST /api/v1/projects/:id/invitations` and the
`/invitations/accept` flow is FE-implemented. U3 adds a minimal invite trigger:

```
features/projects/project-detail-page/components/
├── invite-member-dialog.component.ts    // Material dialog
└── members-list.component.ts             // small panel under project detail
```

`InviteMemberDialogComponent` posts to `POST /projects/:id/invitations` with `{ email,
projectRole }`. On success, the dialog closes and the members list refreshes. Existing
acceptance flow at `/invitations/accept` is unchanged.

---

## Shared types extensions (`core/api/dto.ts`)

Add (in addition to the existing U1/U2 shapes):

```ts
// Project / registration
export type ProjectStatus = 'DRAFT' | 'REGISTERED' | 'UNDER_REVIEW' | 'CERTIFIED' | 'DENIED' | 'WITHDRAWN';
export type MembershipLevel = 'USGBC_MEMBER' | 'NON_MEMBER';
export type BuildingType = 'SINGLE_FAMILY_DETACHED' | 'SINGLE_FAMILY_ATTACHED' | 'TOWNHOUSE';
export type PaymentChoice = 'PAY_NOW' | 'PAY_LATER';
export type InvoiceStatus = 'PAID' | 'UNPAID';
export type BulkRowStatus = 'PENDING' | 'CREATED' | 'FAILED';

export interface AddressDto {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface OwnerDto {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  ownerOrganization: string | null;
}

export interface ProjectDto extends AddressDto, OwnerDto {
  id: string;
  gbciDisplayId: string | null;
  sapProjectId: string | null;
  ratingSystemId: string;
  ratingSystemSlug: string;
  status: ProjectStatus;
  name: string;
  membershipLevel: MembershipLevel;
  buildingType: BuildingType;
  numberOfUnits: number;
  grossArea: number | null;
  targetCertificationLevel: string | null;
  parentAnchorId: string | null;
  registeredAt: string | null;
  registeredByUserId: string | null;
  version: number;
}

export interface DraftProjectDto extends Partial<ProjectDto> { /* same shape, mostly optional */ }

export interface FeeQuoteLineItemDto {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}
export interface FeeQuoteDto {
  amountCents: number;
  currency: 'USD';
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: FeeQuoteLineItemDto[];
  scheduleId: string | null;
  warnings: { reason: string }[];
}

export interface InvoiceDto {
  id: string;
  projectId: string;
  displayId: string;
  paymentChoice: PaymentChoice;
  status: InvoiceStatus;
  currency: 'USD';
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: FeeQuoteLineItemDto[];
  paymentProviderRef: string | null;
  paidAt: string | null;
  generatedAt: string;
  version: number;
}

export interface CertificationAgreementDto {
  id: string;
  projectId: string;
  signedByUserId: string;
  signedByName: string;
  signedAt: string;
  agreementVersion: string;
  agreementTextHash: string;
}

export interface RegisterProjectRequestDto {
  draftProjectId?: string;
  fields: DraftProjectDto;
  paymentChoice: PaymentChoice;
  acceptedAgreementVersion: string; // 'v1.0'
}

export interface RegisterProjectResponseDto {
  project: ProjectDto;
  invoice: InvoiceDto;
  agreement: CertificationAgreementDto;
}

export interface BulkRowOutcomeDto {
  externalRowId: string;
  status: BulkRowStatus;
  projectId: string | null;
  gbciDisplayId: string | null;
  errorMessage: string | null;
}

export interface BulkUploadResponseDto {
  batchId: string;
  totalRows: number;
  succeededRows: number;
  failedRows: number;
  outcomes: BulkRowOutcomeDto[];
}
```

---

## API client extensions (`core/api/api-client.ts`)

```ts
// --- Projects (Unit 3) ----------------------------------------------------
listProjects(mineOnly: boolean): Observable<ProjectDto[]>;
getProject(id: string): Observable<ProjectDto>;
createDraft(fields: DraftProjectDto): Observable<ProjectDto>;
patchProject(id: string, patch: Partial<ProjectDto>): Observable<ProjectDto>;
withdrawProject(id: string, reason: string): Observable<ProjectDto>;
registerProject(req: RegisterProjectRequestDto): Observable<RegisterProjectResponseDto>;
getInvoice(projectId: string): Observable<InvoiceDto>;
getAgreement(projectId: string): Observable<CertificationAgreementDto>;
getFeeQuote(slug: string, level: MembershipLevel): Observable<FeeQuoteDto>;
uploadBulkRegistration(file: File): Observable<BulkUploadResponseDto>;
```

---

## Accessibility (WCAG 2.1 AA carry-over)

- Stepper steps have explicit `aria-label`s and the step heading is `<h2>` for screen readers.
- All form fields use `<mat-form-field>` + `<mat-label>`; required fields carry `required` and a
  visible asterisk via the project's existing tokens.
- The agreement modal traps focus and is dismissable with Esc.
- Color is never the sole indicator on the bulk per-row table — we add an icon column too.
