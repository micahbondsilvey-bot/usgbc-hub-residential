# Unit 3 — Domain Entities

Technology-agnostic domain model for Unit 3 (Project Registration & Fees). All persisted entities
inherit `AuditBase` from Unit 1 (`createdAt/updatedAt/createdBy/updatedBy`).

Decisions reflected (all-A from `unit-3-registration-fees-design-plan.md`):
- Q1=A status enum DRAFT|REGISTERED|UNDER_REVIEW|CERTIFIED|DENIED|WITHDRAWN.
- Q2=A plain address columns + `latitude/longitude DECIMAL(9,6)`.
- Q3=A `RES-100001+` from a Postgres sequence, allocated only after invoice generation.
- Q4=A `MembershipLevel` enum + JSON-seeded `FeeSchedule` table.
- Q5=A `INV-100001+` invoice numbering + `lineItems jsonb`; mock `PaymentProvider`.
- Q6=A bulk row idempotency via required `external_row_id` template column + composite uniqueness.
- Q7=A `exceljs` parser, 2 MB / 200 rows cap.

> **Note on the placeholder** — Unit 2 reserved `DEMO_PROJECT_ID = 00000000-0000-4000-8000-000000000001`
> and seeded a scorecard against it without a backing `Project` row (the `ScorecardEntry.projectId`
> FK was forward-declared). This unit creates that backing row via `DemoSeeder` so existing FE
> bookmarks at `/projects/${DEMO_PROJECT_ID}/scorecard` continue to work.

---

## Project

The top-level entity for a registered LEED v4.1 SF project.

- `id: UUID` (PK)
- `gbciDisplayId: string | null` — sequential `RES-${nextval}` (e.g. `RES-100001`).
  **Null while in `DRAFT`**; allocated by `ProjectNumberGenerator` only after the invoice exists
  (BR-N1 / BR-N2). `UNIQUE` once present.
- `sapProjectId: string | null` — reserved for future SAP integration (NFR-2.1). Always null this build.
- `ratingSystemId: UUID` (FK → `RatingSystem`, soft FK enforced at app layer to keep U2 catalog
  ownership clean).
- `status: ProjectStatus` enum:
  - `DRAFT` — wizard in progress, not yet committed.
  - `REGISTERED` — invoice generated (paid or unpaid), project number issued, scorecard initialized.
  - `UNDER_REVIEW` — set by Unit 5 when the project is submitted for review (state-locks writes).
  - `CERTIFIED` — set by Unit 5 on accept-certification.
  - `DENIED` — set by Unit 5 if final review rejects.
  - `WITHDRAWN` — manually withdrawn by Project Team / Admin.
- `name: string` — project display name; required.
- `membershipLevel: MembershipLevel` enum (`USGBC_MEMBER | NON_MEMBER`); drives fee tier.
- `buildingType: BuildingType` enum (`SINGLE_FAMILY_DETACHED | SINGLE_FAMILY_ATTACHED | TOWNHOUSE`);
  defaulted to `SINGLE_FAMILY_DETACHED`. Forward-compat — extensible without schema change.
- `numberOfUnits: integer` — defaults to 1 (single-family). Reserved for multi-unit forward-compat.
- `grossArea: integer | null` — square feet; optional in DRAFT, validated in REGISTERED.
- `targetCertificationLevel: string | null` — free-form text the user picks ("Targeting Silver"),
  matches one of `RatingSystem.certificationLevels[].name`.
- `parentAnchorId: UUID | null` — self-referencing FK reserved for Unit 6 portfolio hierarchy
  (NFR-2.2). Always null this build.
- **Owner block (US-2.1):**
  - `ownerName: string`
  - `ownerEmail: string`
  - `ownerPhone: string | null`
  - `ownerOrganization: string | null`
- **Address block (Q2=A):**
  - `addressLine1: string`
  - `addressLine2: string | null`
  - `city: string`
  - `region: string` — state/province code.
  - `postalCode: string`
  - `country: string` — ISO-3166-1 alpha-2; default `US`.
  - `latitude: DECIMAL(9,6) | null`
  - `longitude: DECIMAL(9,6) | null`
- `registeredAt: timestamp | null` — set when status flips DRAFT → REGISTERED.
- `registeredByUserId: UUID | null` — actor who completed registration (kept distinct from
  `createdBy` because the entity may be drafted by user A and finalized by user B).
- `version: integer` — default 1, increments on every persisted change (carries U2 forward-compat).
- inherits `AuditBase`.

Constraints / invariants:
- `gbciDisplayId` is unique across all projects when not null (`UNIQUE INDEX WHERE gbciDisplayId
  IS NOT NULL`).
- `latitude` ∈ [-90, 90]; `longitude` ∈ [-180, 180] when set.
- `numberOfUnits >= 1`.
- `grossArea >= 0` when set.
- Status is only allowed to transition forward — application layer enforces (BR-P3).
- A `Project` in `UNDER_REVIEW` is non-writable except by Reviewer / Admin (state-lock; Unit 5
  owns the assertion, U3 calls the existing `StateLockService.assertWritable` stub).

## CertificationAgreement

Per-project signing record (US-2.1, FR-2.4). One project may have many over time but the latest
prevails for display; we keep history for audit.

- `id: UUID`
- `projectId: UUID` (FK → `Project`)
- `signedByUserId: UUID` (FK → `User`)
- `signedByName: string` — captured **at the moment of signing** so a later profile rename does
  not retroactively rewrite who signed (Requirements 2.1.3 explicit).
- `signedAt: timestamp`
- `agreementVersion: string` — e.g., `v1.0`; the `agreementText` is held in code/config, not the DB.
- `agreementTextHash: string` — SHA-256 of the rendered text the user click-through accepted; lets
  us detect text drift later if the agreement text changes.
- inherits `AuditBase`.

Constraints:
- One **effective** agreement per project at any time; older rows are retained but UI shows the
  latest by `signedAt DESC`.

## FeeSchedule

Hand-curated lookup driving `FeeCalculator`. Seeded from
`scripts/seed/fee-schedule.json` by `FeeScheduleSeeder`.

- `id: UUID`
- `ratingSystemSlug: string` — e.g., `leed_v4_1_sf`.
- `membershipLevel: MembershipLevel`
- `amountCents: integer`
- `currency: string` — fixed `USD` this build.
- `effectiveAt: timestamp`
- `retiredAt: timestamp | null`
- inherits `AuditBase`.

Constraints:
- `(ratingSystemSlug, membershipLevel)` UNIQUE among effective rows (validated on seed).
- `amountCents >= 0`.
- `currency = 'USD'` enforced at seed time.

## Invoice

One invoice per registration; multi-line forward-compat (Q5=A).

- `id: UUID`
- `projectId: UUID` (FK → `Project`)
- `displayId: string` — sequential `INV-${nextval}` from `invoices_display_seq`. UNIQUE.
- `paymentChoice: PaymentChoice` enum (`PAY_NOW | PAY_LATER`).
- `status: InvoiceStatus` enum (`PAID | UNPAID`).
  - PAY_NOW → PAID at generation time (mocked `PaymentProvider.recordPaymentIntent` succeeds).
  - PAY_LATER → UNPAID; `markPaid()` would flip it later (out of scope this build).
- `currency: string` — fixed `USD`.
- `subtotalCents: integer`
- `taxCents: integer` — 0 this build (sales tax mocked off).
- `totalCents: integer` — `subtotal + tax`.
- `lineItems: jsonb` — array of `{ description: string, quantity: integer, unitPriceCents: integer,
  totalCents: integer }`. One row this build (the registration fee).
- `paymentProviderRef: string | null` — e.g., `mock_intent_${uuid}`; populated for PAY_NOW only.
- `paidAt: timestamp | null`
- `generatedAt: timestamp`
- `version: integer`
- inherits `AuditBase`.

Constraints:
- `displayId` UNIQUE.
- `(projectId)` UNIQUE (one invoice per project this build; multi-invoice deferred).
- `subtotalCents + taxCents = totalCents` checked at write time.
- `paymentChoice = PAY_NOW` ⇔ `status = PAID` ⇔ `paidAt IS NOT NULL`.

## BulkRegistrationBatch

A single Excel upload (US-2.4).

- `id: UUID`
- `uploaderUserId: UUID` (FK → `User`)
- `fileName: string`
- `fileSizeBytes: integer`
- `totalRows: integer`
- `succeededRows: integer`
- `failedRows: integer`
- `uploadedAt: timestamp`
- `idempotencyHash: string` — SHA-256 of the file bytes; helps the FE warn on dupe re-uploads but
  is not the dedup key (the row-level `externalRowId` is — Q6=A).
- inherits `AuditBase`.

## BulkRegistrationRow

Per-row outcome of a batch.

- `id: UUID`
- `batchId: UUID` (FK → `BulkRegistrationBatch`)
- `uploaderUserId: UUID` — denormalized for the composite uniqueness rule.
- `externalRowId: string` — required template column the user controls (Q6=A).
- `status: BulkRowStatus` enum (`PENDING | CREATED | FAILED`).
- `projectId: UUID | null` — populated when CREATED.
- `errorMessage: string | null` — populated when FAILED.
- `rawRow: jsonb` — the raw parsed row (round-trip property — see PBT-01 in business-logic-model.md).
- inherits `AuditBase`.

Constraints:
- `(uploaderUserId, externalRowId)` UNIQUE — across all batches for a given uploader. Re-upload
  with the same `externalRowId` upserts: a previously `FAILED` row may be retried in a new batch
  and become `CREATED`; a `CREATED` row is left alone (no duplicate `Project` is produced).

## Enums (definitive)

```ts
export enum ProjectStatus {
  DRAFT = 'DRAFT',
  REGISTERED = 'REGISTERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CERTIFIED = 'CERTIFIED',
  DENIED = 'DENIED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum MembershipLevel {
  USGBC_MEMBER = 'USGBC_MEMBER',
  NON_MEMBER = 'NON_MEMBER',
}

export enum BuildingType {
  SINGLE_FAMILY_DETACHED = 'SINGLE_FAMILY_DETACHED',
  SINGLE_FAMILY_ATTACHED = 'SINGLE_FAMILY_ATTACHED',
  TOWNHOUSE = 'TOWNHOUSE',
}

export enum PaymentChoice {
  PAY_NOW = 'PAY_NOW',
  PAY_LATER = 'PAY_LATER',
}

export enum InvoiceStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export enum BulkRowStatus {
  PENDING = 'PENDING',
  CREATED = 'CREATED',
  FAILED = 'FAILED',
}
```

## Relationships (text)

```
RatingSystem 1 ── * Project 1 ── 0..* CertificationAgreement
                          1 ── 0..1 Invoice
                          1 ── * ScorecardEntry  (← U2; FK now resolves to a real Project)
                          1 ── * ProjectMembership  (← U1)

User 1 ── * BulkRegistrationBatch 1 ── * BulkRegistrationRow ── 0..1 Project
FeeSchedule (lookup, no FKs from Project; resolved by code at registration time)
```

## Sequences

Two Postgres sequences are created via SQL in TypeORM migrations / `synchronize`-time DDL hook
(see `business-rules.md` BR-N1 / BR-I1):

- `projects_display_seq` — starts at `100001`, no cycle.
- `invoices_display_seq` — starts at `100001`, no cycle.

`ProjectNumberGenerator` and `InvoiceService` issue display IDs by selecting `nextval(seq)` and
formatting (`RES-${n}`, `INV-${n}`).

## Out of scope (this unit)

- Real card processing — `PaymentProvider` is a mock seam (records intent only).
- Multi-invoice per project — deferred (UNIQUE on `Invoice.projectId` enforces single this build).
- SAP project ID — column reserved, never populated this build.
- Portfolio hierarchy — `parentAnchorId` reserved for Unit 6.
- Workbook auto-generation on attempted-toggle — Unit 4.
- State-lock enforcement on `UNDER_REVIEW` — Unit 5 owns the writer; U3 just imports the existing
  `StateLockService.assertWritable` stub from U2.
