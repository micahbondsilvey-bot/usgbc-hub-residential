# Unit 3 — Business Rules

Decision rules, validation, and constraints for Project Registration & Fees. Technology-agnostic.

## Project (BR-P)

### BR-P1 Identity & uniqueness
- `Project.id` is the internal UUID PK (NFR-2.1).
- `Project.gbciDisplayId` is the user-facing identifier; null until BR-N2 issues it.
- `(gbciDisplayId)` is UNIQUE among non-null values.

### BR-P2 Required fields by status
- In **DRAFT**: only `name`, `ratingSystemId`, and `membershipLevel` are required. The wizard may
  persist partial data (NFR carry-over: server validates only the fields submitted in the
  current step).
- To transition **DRAFT → REGISTERED**: ALL of the following must be present:
  `name`, `ratingSystemId`, `membershipLevel`, `buildingType`, `numberOfUnits`, `grossArea`,
  `ownerName`, `ownerEmail`, full address (line1, city, region, postalCode, country),
  one signed `CertificationAgreement`, and one `Invoice`.
- The application returns `400 Bad Request` with a structured field-error array if any required
  field is missing at registration time.

### BR-P3 Status transitions
- Allowed transitions (one-way unless noted):
  - `DRAFT → REGISTERED` (this unit; via `RegistrationOrchestrator`).
  - `REGISTERED → UNDER_REVIEW` (Unit 5 will set; U3 stub).
  - `UNDER_REVIEW → CERTIFIED | DENIED` (Unit 5).
  - `* → WITHDRAWN` (Project Team or Admin; U3 ships endpoint).
- Disallowed: any backward transition from `UNDER_REVIEW`, `CERTIFIED`, `DENIED`, `WITHDRAWN`.
- Application layer rejects disallowed transitions with `409 Conflict`.

### BR-P4 Address & geolocation validation
- `latitude` ∈ [-90, 90]; `longitude` ∈ [-180, 180]; reject otherwise (`400`).
- Country code MUST be ISO-3166-1 alpha-2 (2 chars, uppercase). Reject otherwise.
- Postal code: free-form string, max length 16, trimmed. (No country-specific format enforcement.)

### BR-P5 Authorization (writes)
- **Create (DRAFT and REGISTERED finalize):** any authenticated user — they automatically become
  the project's `PROJECT_TEAM` member (or `GREEN_RATER` if `User.greenRaterCredentialId` is set
  and they choose that role on the wizard's first step). Membership row is created by the
  orchestrator via `MembershipService.addMember`.
- **Edit non-fee fields after registration (US-2.5, FR-2.8):** any active member of the project
  (`PROJECT_TEAM | GREEN_RATER | REVIEWER`) and Admin.
- **Fee-related fields (`membershipLevel`, anything that derives the fee) are NOT editable
  post-registration.** The application returns `409 Conflict` if a write attempts them on a
  REGISTERED project.
- **Withdraw:** Project Team or Admin only.
- **State-lock:** writes go through `StateLockService.assertWritable(projectId)` (the U2 stub).
  Unit 5 will tighten this; U3 inherits the no-op behavior.

### BR-P6 Audit
- `Project` writes are audit-stamped via `AuditStampInterceptor` on the controller layer (U1
  Q2=B). Status transitions also produce an explicit `AuditService.record` row
  (`entityType: 'Project.status'`, `before/after`).
- Registration completion (DRAFT → REGISTERED) also records:
  - `Project.created` (final form snapshot).
  - `CertificationAgreement.signed`.
  - `Invoice.generated`.
  - `Project.numberIssued`.

---

## Certification agreement (BR-A)

### BR-A1 Click-through preserves user-name-at-time-of-signing
- On accept, capture `signedByUserId`, `signedByName = User.name AT NOW()`, `signedAt = NOW()`,
  and `agreementVersion` (currently `v1.0`).
- A profile rename later does NOT rewrite `signedByName` — Requirements 2.1.3 / US-2.1 explicit.

### BR-A2 Agreement text drift detection
- The signed text body is rendered server-side from a constant string in code (`AGREEMENT_TEXT_V1`)
  and the SHA-256 of that text is stored as `agreementTextHash`.
- If `AGREEMENT_TEXT_V1` is later edited, the next signing produces a different hash; old rows
  remain queryable for forensic comparison.

### BR-A3 One effective agreement per project
- Display the most recent agreement (by `signedAt DESC`) on the project info panel.
- Re-signing is allowed (e.g., after a substantive edit later); creates a new row, never updates
  an existing one.

---

## Fees (BR-F)

### BR-F1 Pure calculator (PBT-01 target)
- `FeeCalculator.compute(input: FeeInput): FeeQuote` is a **pure** function (no Nest imports,
  no I/O). Lives at `src/fees/calculator/fee.calculator.ts`.
- `FeeInput`: `{ ratingSystemSlug, membershipLevel, schedule: FeeScheduleEntry[] }`.
- `FeeQuote`: `{ amountCents, currency, lineItems: [{description, quantity, unitPriceCents,
  totalCents}], scheduleId, subtotalCents, taxCents: 0, totalCents }`.
- The schedule is passed in (resolved by the caller from `FeeScheduleSeeder.findEffective(...)`)
  so the calculator stays pure and easily property-testable.

### BR-F2 Fee resolution
- The active `FeeSchedule` is the row matching `(ratingSystemSlug, membershipLevel)` with
  `effectiveAt <= NOW()` AND `(retiredAt IS NULL OR retiredAt > NOW())`.
- If no row matches, the calculator returns `amountCents: 0` AND a sentinel
  `quote.warnings: [{reason: 'no_fee_schedule_match'}]`. The application surfaces this on the
  fee panel with a "Contact admin" message and blocks finalize until resolved.
- For the all-A defaults this build, the seeded JSON covers both LEED v4.1 SF tiers, so the
  warning path is exercised only under bad data.

### BR-F3 Recompute on inputs change
- The FE shows a live fee quote that recomputes whenever `ratingSystemSlug` or `membershipLevel`
  changes. Server-side recompute on every quote call is authoritative.

### BR-F4 Currency
- USD only this build. The schedule seed file MUST set `currency: 'USD'` for every row;
  `FeeScheduleSeeder` fail-fasts otherwise.

### BR-F5 Rounding
- All fee math is in integer cents. No fractional cents; no client-side rounding ever.

### BR-F6 Pure → testable
- `FeeCalculator.compute` is **deterministic**: same inputs ⇒ same output (PBT-01 property —
  see business-logic-model.md FL-1).

---

## Invoice (BR-I)

### BR-I1 Display ID generation (Q5=A)
- A Postgres sequence `invoices_display_seq` (start at 100001, no cycle) issues monotonically
  increasing integers.
- `InvoiceService.generate(...)` does `SELECT nextval('invoices_display_seq')`, formats
  `INV-${n}`, and persists.
- DB sequence is created by `RegistrationDdlBootstrapper` (see business-logic-model.md BL-7) on
  module init; seed-safe (CREATE SEQUENCE IF NOT EXISTS).

### BR-I2 One invoice per project (this build)
- UNIQUE INDEX on `Invoice.projectId`. Attempting to generate a second invoice returns `409
  Conflict`.

### BR-I3 Pay-now vs pay-later semantics (Q5=A)
- `PAY_NOW`:
  - Mocked `PaymentProvider.recordPaymentIntent({ amountCents, currency, projectId })` returns
    `{ providerRef: 'mock_intent_${uuid}', status: 'succeeded' }` synchronously.
  - `Invoice.status = PAID`, `paidAt = NOW()`, `paymentProviderRef = providerRef`.
- `PAY_LATER`:
  - No provider call.
  - `Invoice.status = UNPAID`, `paidAt = null`, `paymentProviderRef = null`.

### BR-I4 Generation gates project number
- `RegistrationOrchestrator` runs `InvoiceService.generate(...)` BEFORE
  `ProjectNumberGenerator.allocate(...)`. If invoice generation fails, the orchestrator rolls
  back the transaction (no `gbciDisplayId`, no email).

### BR-I5 Total integrity
- `subtotalCents + taxCents = totalCents` MUST hold. Application layer asserts on write.
- `lineItems[].totalCents = quantity * unitPriceCents` MUST hold. Application layer validates
  per line.

### BR-I6 Visibility
- `GET /api/v1/projects/:projectId/invoice` returns the invoice (any active project member or Admin).
- The agreement is bundled with the invoice on the FE confirmation view (FR-2.8 — invoice and
  signed agreement viewable after registration).

---

## Project number (BR-N)

### BR-N1 Sequential allocation
- A Postgres sequence `projects_display_seq` (start at 100001, no cycle) backs allocation.
- `ProjectNumberGenerator.allocate()` does `SELECT nextval('projects_display_seq')`, formats
  `RES-${n}`, returns the string.

### BR-N2 Allocation timing
- Called by the orchestrator AFTER `InvoiceService.generate(...)` succeeds (BR-I4).
- Updates `Project.gbciDisplayId` and `Project.status = REGISTERED` and `Project.registeredAt`
  in the same transaction.

### BR-N3 Idempotency on retry
- If the orchestrator retries after a partial failure (e.g., crash between invoice generation and
  number issue), the next run finds `Project.gbciDisplayId IS NOT NULL` and short-circuits the
  allocation. The sequence has already advanced — small gaps are acceptable and expected.

### BR-N4 Format invariants (PBT-target candidate, not generated this build)
- Output MUST match `/^RES-\d{6,}$/`.
- Output MUST be unique across the lifetime of the database (DB UNIQUE constraint guarantees).

---

## Bulk registration (BR-B)

### BR-B1 Template structure (Q6=A)
- The Excel template has a fixed header row (case-insensitive, trimmed):
  `external_row_id, name, rating_system_slug, membership_level, building_type, number_of_units,
  gross_area, target_certification_level, owner_name, owner_email, owner_phone,
  owner_organization, address_line1, address_line2, city, region, postal_code, country,
  latitude, longitude, payment_choice`.
- Missing required headers ⇒ `400 Bad Request`, no rows processed.

### BR-B2 Per-row validation
- Each row is validated independently. Failures collected; valid rows still processed (FR-2.6).
- Required per row: `external_row_id`, `name`, `rating_system_slug`, `membership_level`,
  `building_type`, `gross_area`, `owner_name`, `owner_email`, `address_line1`, `city`, `region`,
  `postal_code`, `country`, `payment_choice`.
- Email format validated (RFC-5321-light).
- Enum-typed columns (`membership_level`, `building_type`, `payment_choice`) are normalized
  case-insensitively and rejected if not in the enum.
- `latitude`/`longitude` if provided MUST satisfy BR-P4.

### BR-B3 Idempotent re-upload (Q6=A)
- The dedup key is `(uploaderUserId, externalRowId)`.
- For each input row:
  - If a `BulkRegistrationRow` exists with this key in status `CREATED`: leave it alone, return
    "already created" outcome (no error, no duplicate `Project`).
  - If exists in status `FAILED`: insert a new `BulkRegistrationRow` row in the new batch and
    re-attempt creation. On success, the new row is `CREATED`; the old `FAILED` row is left in
    place for audit (the unique index permits this because the old row's batch differs and the
    composite uniqueness is enforced at the **CREATED-status level only** via partial unique
    index).
  - If no row exists: insert + attempt as usual.
- The partial unique index is:
  `UNIQUE INDEX bulk_row_idem_unique ON bulk_registration_rows (uploaderUserId, externalRowId)
   WHERE status = 'CREATED'`.

### BR-B4 File caps (Q7=A)
- Max file size: **2 MB**. Reject with `413 Payload Too Large` otherwise.
- Max row count: **200**. Reject with `400 Bad Request` otherwise.
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  (xlsx) and `application/vnd.ms-excel` (xls). Reject others with `415 Unsupported Media Type`.

### BR-B5 Parser purity (PBT-01 target)
- `BulkRegistrationParser.parseRows(buffer): ParsedRow[]` is **pure** in the sense it has no
  side effects beyond reading the buffer and returning structured rows; reads from `exceljs`
  in-memory.
- The round-trip property: for any well-formed `ParsedRow[]`, `serialize(parseRows(buffer)) ===
  parseRows(serialize(parseRows(buffer)))` (idempotent canonicalization). Used as a PBT-01
  property in business-logic-model.md (FL-2).

### BR-B6 Per-row creation flow
- Each valid row goes through the same `RegistrationOrchestrator` as individual registration,
  with `paymentChoice` taken from the row. Agreement is not part of bulk this build (rows are
  created with a synthetic `CertificationAgreement` referencing `signedByUserId =
  uploaderUserId` and `agreementVersion = 'v1.0-bulk'` so the audit trail still shows who
  pushed the row).

### BR-B7 Bulk authorization
- `POST /api/v1/projects/bulk` is allowed for any authenticated user. They become PROJECT_TEAM
  on each created project (orchestrator behavior). Admin can bulk on behalf of others by
  passing a `as_user_id` query param (admin-only) — out of scope this build; flagged for
  Unit 7.

---

## Email (BR-E)

### BR-E1 Registration confirmation email (US-2.3 / FR-2.5)
- Sent **after** `Project.status = REGISTERED` and the invoice has been generated and the
  project number issued.
- Routed through `NotificationGateway.send({ kind: 'registration-confirmation', ... })`.
- Best-effort by design (U1 NFR Design Q4=A) — failures do not roll the transaction back.
- Subject: `Your LEED v4.1 SF project is registered: ${gbciDisplayId}`.
- Payload includes a JSON `context` with `{ gbciDisplayId, invoiceDisplayId, paymentChoice,
  paymentStatus, totalCents, currency }` for log inspection during development.
- Recipient: `Project.ownerEmail` (primary). The orchestrator also CCs the actor's email if
  different — represented in the mocked log as a second `send` call with a separate
  `to`. The U1 Q4=A "best-effort" rule applies independently per send.

---

## State-lock & forward-compat (BR-Z)

### BR-Z1 State-lock writes
- All `Project` and `Invoice` mutations call `StateLockService.assertWritable(projectId)` first.
- The U2 stub no-ops; Unit 5 replaces with the real `UNDER_REVIEW`-aware enforcement.

### BR-Z2 Workbook hand-off (forward-compat)
- After `Project.status = REGISTERED`, the project is a valid target for U4's workbook auto-
  generation when an attempted toggle flips. Nothing in U3 talks to U4; the contract is the
  `Project` row existing with the right status.

---

## API behavior (summary)

### BR-API1 Read paths
- `GET /api/v1/projects/:projectId` — project detail (member or Admin).
- `GET /api/v1/projects/:projectId/agreement` — latest `CertificationAgreement`.
- `GET /api/v1/projects/:projectId/invoice` — invoice for the project.
- `GET /api/v1/projects?mine=true` — list projects the caller is a member of (or all, for Admin).
- `GET /api/v1/registration/fee-quote?ratingSystemSlug=...&membershipLevel=...` — live fee
  quote (any authenticated user).

### BR-API2 Write paths
- `POST /api/v1/projects` — start a draft and/or register in one shot. Body shape varies by
  intent (`mode: 'draft' | 'register'`).
- `PATCH /api/v1/projects/:projectId` — non-fee field edits post-registration (or any field
  in DRAFT). 409 on fee-related field writes against REGISTERED.
- `POST /api/v1/projects/:projectId/agreement` — sign the agreement (used during registration).
- `POST /api/v1/projects/:projectId/withdraw` — Project Team or Admin only.
- `POST /api/v1/projects/bulk` — multipart Excel upload.

All write paths route through the relevant orchestrator/service and respect `ProjectRolesGuard`
for project-scoped routes.
