# Unit 3 — Project Registration & Fees — Code summary

This is the implementation summary for Unit 3. The plan lives at
`aidlc-docs/construction/plans/unit-3-registration-fees-code-generation-plan.md`.
NFR Requirements and NFR Design were skipped per user direction (2026-06-25);
all cross-cutting NFR concerns inherit from U1 and U2 unchanged.

---

## Backend file inventory (`usgbc-hub-residential-be/`)

### Projects domain
- `src/projects/enums/project.enums.ts` — ProjectStatus, MembershipLevel, BuildingType, PaymentChoice, InvoiceStatus, BulkRowStatus.
- `src/projects/state-machine/project-status.machine.ts` — pure `assertTransition` (PBT-01 target FL-4).
- `src/projects/agreement-text.ts` — `AGREEMENT_TEXT_V1` + `AGREEMENT_TEXT_V1_HASH` (BR-A2 drift detection).
- `src/projects/project.entity.ts` — `Project` with partial unique on `gbciDisplayId`.
- `src/projects/certification-agreement.entity.ts` — `CertificationAgreement` (BR-A1 name snapshot).
- `src/projects/registration-ddl.bootstrapper.ts` — creates `projects_display_seq` / `invoices_display_seq` (BL-7).
- `src/projects/project-number.generator.ts` — sequential `RES-${nextval}` (BR-N1..N4, FL-3 PBT target).
- `src/projects/projects.service.ts` — find/list/createDraft/patch/withdraw/transitionStatus + visibility/writer/withdrawer authorization (BR-P5).
- `src/projects/agreement.service.ts` — sign-agreement subflow (BL-5).
- `src/projects/registration.orchestrator.ts` — multi-step register flow with embedded `assertRegisterReadiness` (BL-1, exported pure helper).
- `src/projects/projects.controller.ts` — REST surface for projects + register + agreement + withdraw.
- `src/projects/projects.demo-seeder.ts` — bridges U2's placeholder UUID to a real `Project` row at `RES-100000` (BL-6).
- `src/projects/projects.module.ts`.
- `src/projects/dto/{draft-project, project, patch-project, register-project, register-project-response, agreement, withdraw-project}.dto.ts`.

### Bulk registration
- `src/projects/bulk/bulk-registration-batch.entity.ts`.
- `src/projects/bulk/bulk-registration-row.entity.ts` — partial unique index on `(uploaderUserId, externalRowId) WHERE status = 'CREATED'` (BR-B3).
- `src/projects/bulk/bulk-registration.parser.ts` — pure `parseRows` + `serialize` round-trip (BR-B5, FL-2 PBT target). Uses `exceljs`.
- `src/projects/bulk/bulk-registration.orchestrator.ts` — per-row register with idempotency (BL-4).
- `src/projects/bulk/bulk-registration.controller.ts` — multipart upload with `@Throttle(5,60)` and 2 MB / 200-row caps (BR-B4).
- `src/projects/bulk/dto/{bulk-row-outcome, bulk-upload-response}.dto.ts`.

### Fees & invoicing
- `src/fees/fee-schedule.entity.ts` — partial unique on `(ratingSystemSlug, membershipLevel) WHERE retired_at IS NULL`.
- `src/fees/calculator/fee.calculator.ts` — pure `compute(input)` + `findEffective` (BR-F1..F6, FL-1 PBT target).
- `src/fees/fee-schedule.seeder.ts` — JSON-seeded with seed-time invariant assertions (member ≤ non-member).
- `scripts/seed/fee-schedule.json` — 2 rows: USGBC_MEMBER $900, NON_MEMBER $1200.
- `src/fees/fees.service.ts` / `fees.controller.ts` — `GET /registration/fee-quote`.
- `src/fees/invoice.entity.ts` — UNIQUE on displayId AND projectId (BR-I2 single-invoice).
- `src/fees/invoice.service.ts` — sequence-driven displayId, totals invariants enforced (BR-I5, FL-5 PBT target).
- `src/fees/invoice.controller.ts` — `GET /projects/:projectId/invoice`.
- `src/fees/payment-provider.{interface,mock}.ts` — provider seam, mock returns `mock_intent_${uuid}`.
- `src/fees/fees.module.ts`.

### App-wide wiring
- `src/app.module.ts` — registers `Project`, `CertificationAgreement`, `BulkRegistrationBatch`, `BulkRegistrationRow`, `FeeSchedule`, `Invoice` entities and imports `FeesModule` + `ProjectsModule`.

## Frontend file inventory (`usgbc-hub-residential-fe/`)

- `src/app/core/api/dto.ts` — extended with U3 shapes (Project, Invoice, Agreement, FeeQuote, BulkRowOutcome, etc.).
- `src/app/core/api/api-client.ts` — extended with `listProjects`, `getProject`, `createDraftProject`, `patchProject`, `withdrawProject`, `registerProject`, `getInvoice`, `getAgreement`, `getAgreementText`, `getFeeQuote`, `uploadBulkRegistration`.
- `src/app/features/registration/registration.store.ts` — Signals store with sessionStorage persistence keyed `gbci.draft.registration:${userId}`.
- `src/app/features/registration/registration-page.component.ts` — Material `<mat-stepper>` hosting the 5-step register flow (rating + membership → details → owner → address → agreement → fees & payment) plus an inline confirmation block. In edit-mode the same component renders without the agreement / fees steps and exposes a `Save changes` action.
- `src/app/features/registration/agreement-modal.component.ts` — click-through dialog with the rendered text + accept-checkbox + Sign action.
- `src/app/features/projects/projects-list-page.component.ts` — `/projects`, Material table.
- `src/app/features/projects/project-detail-page.component.ts` — `/projects/:projectId`, with edit / scorecard / withdraw / invite actions.
- `src/app/features/projects/invite-member-dialog.component.ts` — posts to U1's `/projects/:id/invitations` (US-2.6).
- `src/app/features/bulk/bulk-upload-page.component.ts` — `/projects/bulk`, drag-drop with per-row outcome table.
- `src/app/app.routes.ts` — adds `/projects`, `/projects/register`, `/projects/bulk`, `/projects/:projectId`, `/projects/:projectId/edit`. Default redirect changed `'' → '/projects'`.
- `src/app/app.component.ts` — header now shows `Projects` and `Register` links alongside the existing `Demo scorecard` link.

## Backend endpoints (new in U3)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/projects` | any auth | Lists caller's projects (admin sees all) |
| POST | `/api/v1/projects` | any auth | Creates a DRAFT project (auto-creates PROJECT_TEAM membership) |
| POST | `/api/v1/projects/register` | any auth | Runs the orchestrator: agreement → fee → invoice → number → email |
| GET | `/api/v1/projects/agreement-text?version=v1.0` | any auth | Returns rendered text + hash |
| GET | `/api/v1/projects/:projectId` | member or admin | Project detail |
| PATCH | `/api/v1/projects/:projectId` | member or admin | Edit non-fee fields (409 on fee fields after registration) |
| POST | `/api/v1/projects/:projectId/withdraw` | Project Team or admin | Status → WITHDRAWN |
| GET | `/api/v1/projects/:projectId/agreement` | member or admin | Latest signed agreement |
| POST | `/api/v1/projects/:projectId/agreement` | member or admin | Out-of-band sign |
| GET | `/api/v1/projects/:projectId/invoice` | member or admin | Invoice for the project |
| GET | `/api/v1/registration/fee-quote?ratingSystemSlug=…&membershipLevel=…` | any auth | Live fee quote |
| POST | `/api/v1/projects/bulk` | any auth | Multipart Excel upload (2 MB / 200 rows / 5 uploads/min) |

## Demo data after seed

- `Project` row at `00000000-0000-4000-8000-000000000001` (`RES-100000`, REGISTERED, Silver target, Washington DC address, demo owner).
- Demo `Invoice` `INV-100000` (PAID, $0 — demo).
- Demo `CertificationAgreement` v1.0 signed by "GBCI Demo".
- `FeeSchedule`: leed_v4_1_sf · USGBC_MEMBER → 90000, NON_MEMBER → 120000.
- `projects_display_seq` and `invoices_display_seq` start at 100001 (next live IDs are RES-100001 / INV-100001).

## Story coverage

| Story | Status | Where |
|---|---|---|
| US-2.1 individual register | ✅ | `RegistrationOrchestrator` + `RegistrationPageComponent` (5-step wizard) |
| US-2.2 GBCI project number | ✅ | `ProjectNumberGenerator` issued only after invoice (BR-I4 → BR-N2) |
| US-2.3 fees + invoice + email | ✅ | `FeeCalculator` + `InvoiceService` + `NotificationGateway.send({kind:'registration-confirmation'})` |
| US-2.4 bulk upload | ✅ | `BulkRegistrationOrchestrator` + `BulkUploadPageComponent` with idempotent re-upload |
| US-2.5 edit registration | ✅ | `ProjectsService.patch` + `RegistrationPageComponent` in edit-mode (fee fields disabled) |
| US-2.6 invite users | ✅ | `InviteMemberDialogComponent` (FE; BE invitations engine landed in U1) |

## PBT compliance for U3

- **PBT-01**: COMPLIANT — five properties documented (FL-1..FL-5). Pure subjects implemented and isolated:
  - `src/fees/calculator/fee.calculator.ts` (FL-1)
  - `src/projects/bulk/bulk-registration.parser.ts` `parseRows`/`serialize` (FL-2)
  - `src/projects/state-machine/project-status.machine.ts` `assertTransition` (FL-4)
  - `RegistrationOrchestrator.assertRegisterReadiness` exported pure helper (BL-1 readiness)
- **PBT-09**: COMPLIANT — fast-check carried over from U1.
- **PBT-02..08, PBT-10**: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per the U1 precedent. The pure modules above are written without Nest imports so a future PBT pass slots in without code rework.

## Run instructions

The full local stack (Postgres + Redis + backend on :3000 + frontend on :4200) is unchanged from U1/U2. Restart the backend (`npm run start:dev` from `usgbc-hub-residential-be/`) so the seeders pick up the new entities and sequences. Visit `http://localhost:4200/projects` after signing in.

Smoke test commands (after `npm run build` + restart):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"team@residential.test","password":"Team123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Live fee quote
curl -s "http://localhost:3000/api/v1/registration/fee-quote?ratingSystemSlug=leed_v4_1_sf&membershipLevel=USGBC_MEMBER" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Full register
curl -s -X POST http://localhost:3000/api/v1/projects/register \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"fields":{"name":"Smoketest Home","ratingSystemSlug":"leed_v4_1_sf","membershipLevel":"USGBC_MEMBER","buildingType":"SINGLE_FAMILY_DETACHED","numberOfUnits":1,"grossArea":2200,"ownerName":"Owner","ownerEmail":"o@example.com","addressLine1":"1 Test","city":"DC","region":"DC","postalCode":"20001","country":"US"},"paymentChoice":"PAY_NOW","acceptedAgreementVersion":"v1.0"}' \
  | python3 -m json.tool
```
