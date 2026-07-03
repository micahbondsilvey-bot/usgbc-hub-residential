# Unit 3 — Business Logic Model

End-to-end orchestration for Project Registration & Fees. Tech-agnostic narratives + the
property-based-testing (PBT-01) targets; backed by the entities and rules.

---

## BL-1 RegistrationOrchestrator — `register(...)` happy path (US-2.1, US-2.3)

Inputs: `RegisterRequest = { draftProjectId? | newProjectFields, paymentChoice,
acceptedAgreementVersion }`.

```text
1. resolveOrCreateDraft(req) → Project (status = DRAFT)
   - If draftProjectId given → load + assertWritable + assert ownership.
   - Else create with the submitted fields + auto-create PROJECT_TEAM membership.
2. assertRegisterReadiness(project) per BR-P2.
3. recordCertificationAgreement(project, actor, acceptedAgreementVersion)
   - signedByName captured at this moment (BR-A1).
4. computeFee → resolve FeeSchedule → FeeCalculator.compute(...) → FeeQuote.
5. generateInvoice(project, quote, paymentChoice) per BR-I1..I5.
   - PAY_NOW → PaymentProvider.recordPaymentIntent (mock) → status = PAID.
   - PAY_LATER → status = UNPAID.
6. allocateProjectNumber(project) per BR-N1..N3.
   - Sets gbciDisplayId, status = REGISTERED, registeredAt = NOW(),
     registeredByUserId = actor.id.
7. sendRegistrationConfirmationEmail(project, invoice) per BR-E1
   - Best-effort via NotificationGateway; failures swallowed.
8. AuditService.record × 4 (Project.created, CertificationAgreement.signed, Invoice.generated,
   Project.numberIssued, Project.status DRAFT→REGISTERED).
```

All steps 1-6 run in a single TypeORM transaction (the orchestrator is `@Transactional`-equivalent
via explicit `dataSource.transaction(async (manager) => {...})`). Step 7 (email) runs after
commit so a failed send never aborts a registration.

Failure modes:
- Step 2 fails (missing fields) → `400` with field-error array. Project remains DRAFT.
- Step 4 fails (no schedule match) → `409` "fee schedule unavailable". Project remains DRAFT.
- Step 5 fails (mock provider returns failure for PAY_NOW; not produced by the mock today, but
  forward-compat) → transaction rolls back. Project remains DRAFT.
- Step 6 idempotent retry → if `gbciDisplayId` already set, short-circuit (BR-N3).

---

## BL-2 Edit-after-registration (US-2.5, BR-P5)

```text
1. project = ProjectsService.findById(projectId)
2. assertWritable (state-lock + role) — Project Team / Green Rater / Reviewer / Admin.
3. validate patch body — strip out fee-related fields; reject 409 if user attempted them.
4. apply patch; set version++.
5. AuditService.record (Project.updated; before/after on changed fields only).
```

---

## BL-3 Withdraw (BR-P3)

```text
1. project = ProjectsService.findById(projectId)
2. assertWriter is Project Team or Admin.
3. assert status ∈ {DRAFT, REGISTERED} (other statuses reject 409).
4. set status = WITHDRAWN; version++; capture withdrawal note.
5. AuditService.record (Project.status before/after; reason field carries the note).
```

---

## BL-4 BulkRegistrationOrchestrator — `bulkRegister(...)` (US-2.4)

Inputs: multipart upload `{ file: Buffer, fileName, mimeType }`, actor.

```text
1. validateFile(buffer, mimeType, fileName) per BR-B4.
2. parsedRows = BulkRegistrationParser.parseRows(buffer)  (pure, throws on header issues).
3. Create BulkRegistrationBatch row (idempotencyHash = SHA-256 of buffer).
4. For each row in parsedRows:
   a. Insert BulkRegistrationRow (status = PENDING, rawRow = row).
   b. validateRow(row) per BR-B2.
   c. If invalid → row.status = FAILED; errorMessage = ...; continue.
   d. Look up existing partial-unique-index hit for (actor.id, row.externalRowId, status=CREATED):
      - If hit → row.status = CREATED, projectId = previousProjectId (no duplicate Project).
      - Else → call RegistrationOrchestrator.register(...) with row's data + synthetic agreement.
        - On success → row.status = CREATED, projectId = newProject.id.
        - On failure → row.status = FAILED, errorMessage = e.message.
5. Update batch counts (succeededRows, failedRows).
6. Return summary { batchId, totalRows, succeeded, failed, perRowOutcomes[] }.
```

Each row's `register(...)` runs in its own transaction (per-row commit). Bulk-level transaction
would cause one bad row to abort everything, contradicting FR-2.6 "valid rows still processed".

---

## BL-5 Sign-agreement subflow (BR-A1)

```text
1. project = ProjectsService.findById(projectId); assertWritable.
2. agreementText = AGREEMENT_TEXT_V1; hash = sha256(text).
3. Insert CertificationAgreement {
     projectId, signedByUserId = actor.id, signedByName = actor.name (snapshot),
     signedAt = NOW(), agreementVersion = 'v1.0', agreementTextHash = hash
   }.
4. AuditService.record (CertificationAgreement.signed).
5. Return entity (text rendered separately on the FE for click-through display).
```

---

## BL-6 Demo seed bridge (BR-D1 carry-over)

Replaces the U2 placeholder behavior with a real `Project` row at the same UUID:

```text
1. On module init (after CatalogSeeder + DemoSeeder), ProjectsDemoSeeder runs.
2. Find or create Project with id = DEMO_PROJECT_ID:
   - If exists with createdBy = null (still pristine): system-update with the canonical demo
     fields (Silver-targeting, sample address, etc.). Do NOT touch user-edited rows.
   - If does NOT exist: system-insert with all required REGISTERED fields, gbciDisplayId =
     'RES-100000' (special demo number BELOW the live sequence floor of 100001 so it never
     collides), status = REGISTERED, registeredAt = a fixed past timestamp.
3. Find or create demo Invoice for the demo project (gbciDisplayId 'INV-100000', PAID, $0 fee
   for the demo).
4. Find or create demo CertificationAgreement (signedByName = 'GBCI Demo', v1.0).
5. Memberships are reconciled by the existing U2 DemoSeeder; this seeder runs first to ensure
   the Project row exists when DemoSeeder's MembershipService.addMember runs.
```

`ProjectsDemoSeeder` runs **before** the existing `DemoSeeder` in the lifecycle by being
imported in `ProjectsModule` and listed before `ScorecardModule` in `app.module.ts`.

---

## BL-7 RegistrationDdlBootstrapper

A small `OnModuleInit` provider in `ProjectsModule` that runs raw SQL to create the two display
sequences:

```sql
CREATE SEQUENCE IF NOT EXISTS projects_display_seq START 100001 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS invoices_display_seq START 100001 NO CYCLE;
```

Runs idempotently on every boot. Required because TypeORM `synchronize: true` does not manage
sequences directly. Logged at info on first creation.

---

## Testable Properties (PBT-01)

Five properties identified for U3. **Tests are NOT generated this build per the documented U1
PBT deviation**, but the calculator and parser are coded to be test-friendly (no Nest imports,
deterministic).

### FL-1 FeeCalculator determinism + monotonicity
- For any `FeeInput`: `compute(input)` is deterministic — same inputs ⇒ same output.
- For two inputs differing only in `membershipLevel`, `compute(USGBC_MEMBER).amountCents <=
  compute(NON_MEMBER).amountCents` (members never pay more than non-members; encoded as a seed-
  data invariant, asserted at seed time).
- For any input where the schedule has no match, `amountCents === 0` AND `quote.warnings`
  contains `'no_fee_schedule_match'`.

### FL-2 BulkRegistrationParser round-trip idempotence
- For any `ParsedRow[]`: `parseRows(serialize(rows)) === rows` (after canonicalization —
  same column order, trimmed strings, normalized enum casing).
- Equivalent: `serialize(parseRows(buf)) → parseRows(...) === parseRows(buf)` (idempotent).

### FL-3 ProjectNumberGenerator format invariant
- For all allocations: output matches `/^RES-\d{6,}$/`.
- For all allocations: output is unique (database UNIQUE constraint guarantees; testable in a
  PBT scenario by simulating concurrent allocations against an in-memory sequence stub).

### FL-4 Status transition state machine
- For all `(from, to)` pairs in `ProjectStatus²`: `assertTransition(from, to)` is `true` iff
  `(from, to)` ∈ allowedSet (BR-P3). All other pairs throw.
- Transitivity: `DRAFT → REGISTERED → UNDER_REVIEW → CERTIFIED` is the canonical happy path; no
  intermediate skips.
- Idempotence on disallowed: throwing twice doesn't change state.

### FL-5 Invoice total integrity
- For any `Invoice` saved by `InvoiceService.generate`: `subtotalCents + taxCents === totalCents`.
- For each line item: `quantity * unitPriceCents === totalCents` for that line.
- Sum of line totals === `subtotalCents`.

> The five properties are test-targets; per the documented U1 deviation no test files are emitted
> in U3. Each property's pure subject (`FeeCalculator`, `BulkRegistrationParser`, the parser's
> serialize helper, `assertTransition`, the Invoice math helper) is implemented as a pure module
> with no Nest imports so a future `pbt/` test pass can pick it up without rework.

---

## Cross-cutting touchpoints (no new infra)

| Concern | Where it's handled |
|---|---|
| Audit timestamps | `AuditStampInterceptor` (HTTP) + `AuditStampHelper.stampSystem*` (orchestrator/seeders) |
| Audit log rows | `AuditService.record(...)` on every status transition + agreement/invoice/number emission |
| Throttling | Inherited global throttler; bulk upload route gets `@Throttle(5, 60)` (5 uploads/min) |
| Auth & RBAC | `JwtAuthGuard` (global) + `ProjectRolesGuard` per-project routes |
| Request context | `RequestContextService` (used by `AuditService` for actorUserId default) |
| Notifications | `NotificationGateway.send({ kind: 'registration-confirmation', ... })` |
| Logging / masking | Inherited `Logger` with email masking on registration-confirmation logs |
| FE auth | Existing `authGuard` + `projectRoleGuard` route guards |
| FE state | Signal-based stores (`RegistrationStore`, `ProjectStore`) + sessionStorage for wizard drafts |
