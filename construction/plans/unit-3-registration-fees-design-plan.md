# Unit 3 — Project Registration & Fees — Batched Design Plan

**Cadence note (deviation from default AI-DLC).** Per user direction (2026-06-25):
- **NFR Design is skipped for U3.** No `nfr-design-patterns.md` / `logical-components.md` will be
  produced for this unit. Cross-cutting NFR patterns are inherited from U1 (RBAC, audit, throttler,
  request context, notification gateway, expiry service, audit-stamp interceptor) and U2
  (TypeORM patterns, in-process cache, pure calculator + PBT seams). No new infra is introduced
  by U3.
- **NFR Requirements** are also not re-issued as separate artifacts; only U3-specific deltas are
  captured inline in the FD (e.g., upload size cap, email mock cadence). Globally-pinned NFRs from
  U1/U2 (Angular 20.2 / Node 20.19, NestJS, PG, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA,
  HS256/8h, sessionStorage tokens) carry forward unchanged.
- **What this plan produces:** Functional Design artifacts (`domain-entities.md`,
  `business-rules.md`, `business-logic-model.md`, `frontend-components.md`) **and** the U3
  Code Generation Plan in **one wave**, gated by a single approval.

---

## Stories in scope

| Story | Title | Build Order | Notes |
|---|---|---|---|
| US-2.1 | Register an individual project | 4 | Rating-system selection, captures, agreement |
| US-2.2 | Generate GBCI-Certify project number | 5 | Post pay/commit only; sequential `RES-1XXXXX` |
| US-2.3 | Fees + invoice + confirmation email | 4 | Pure `FeeCalculator` (PBT target), pay-now/later |
| US-2.4 | Bulk register via Excel upload | 6 | Idempotent re-upload, parse round-trip (PBT target) |
| US-2.5 | Edit registration details post-registration | 6 | All four roles edit non-fee fields |
| US-2.6 | Invite users to a project (FE side) | 6 | BE invite engine landed in U1 |

---

## Architectural decisions inherited (NOT re-asked)

| From | Decision |
|---|---|
| U1-Q1 (auth model) | Hybrid RBAC: global Admin + per-project roles. `ProjectRolesGuard` protects all `/projects/:id/*` routes. |
| U1-Q2 (audit) | Controller-layer `AuditStampInterceptor` for HTTP writes; `AuditStampHelper.stampSystemInsert/Update` for system-driven writes (seeders, orchestrators). |
| U1-Q4 (notifications) | Mock `NotificationGateway` — best-effort send, structured log, no retry. |
| U1-Q9 (PBT) | fast-check, ≥100 runs, deterministic `FAST_CHECK_SEED`. Tests skipped per documented U1 deviation; pure modules MUST stay test-friendly (no Nest imports). |
| U2-Q4 (write semantics) | Last-write-wins; `version: integer` on every persisted row for forward-compat. |
| U2-Q11 (FE store) | Signal-based stores per feature; `sessionStorage` for in-progress wizard state. |
| App design | Single `RegistrationOrchestrator` coordinates the 5-step register flow (create project → record agreement → compute fee → generate invoice → issue project number → send email). |

---

## Design questions (8)

> All questions are FD-level. Recommended choice in **bold** when unambiguous.

### Q1 — Project status enum (US-2.1, US-2.5, US-7.x forward-compat)
- A. **Minimal set this unit: `DRAFT` (in wizard) | `REGISTERED` (post pay/commit) | `UNDER_REVIEW` (forward-compat, set by U5) | `CERTIFIED` | `DENIED` | `WITHDRAWN`.**
- B. Just `REGISTERED` for now; let U5 add the rest.
- C. User-defined values.

### Q2 — Project address / geolocation
- A. **Plain columns: `addressLine1/2`, `city`, `region`, `postalCode`, `country`, `latitude DECIMAL(9,6)`, `longitude DECIMAL(9,6)`. No PostGIS this build.**
- B. Single `address: jsonb` blob.
- C. PostGIS `geography(Point, 4326)`.

### Q3 — Project-number format & generator (US-2.2)
- A. **`RES-100001` and up. Sequential, allocated via a Postgres `sequence` (`projects_display_seq`) with starting value `100001`. Format: `RES-${seq}`. Allocated only after invoice generation (BR-2-2). Stored on the project as `gbciDisplayId UNIQUE`.**
- B. Random 6-digit code with collision retry.
- C. UUID-based suffix.

### Q4 — Membership level & fee inputs (US-2.3)
- A. **Enum on Project: `USGBC_MEMBER | NON_MEMBER`. Fee schedule keyed on `(ratingSystemSlug, membershipLevel) → amountCents`. Hand-curated table seeded from JSON (mirrors LEED v4.1 SF residential standard fees). FE wizard requires the user to pick membership level explicitly; default `NON_MEMBER`.**
- B. Free-form string; fee logic inferred via lookup table.
- C. No fee tiers; flat fee for all projects.

### Q5 — Invoice numbering & line items (US-2.3)
- A. **`INV-${seq}` from `invoices_display_seq` starting at `100001`. Single line item per invoice for now: `description`, `quantity=1`, `unitPriceCents`, `totalCents`. `lineItems jsonb` to allow multi-line later. `paymentChoice: PAY_NOW | PAY_LATER`. `status: PAID | UNPAID` (PAY_NOW = PAID; PAY_LATER = UNPAID; payment processing deferred — `PaymentProvider` mock).**
- B. UUID-only invoice IDs (no display).
- C. Tightly coupled to project (no separate invoice entity).

### Q6 — Bulk-registration row idempotency key (US-2.4)
- A. **Required template column `external_row_id` (free-form string the user controls). Composite uniqueness `(uploaderUserId, externalRowId)` on `BulkRegistrationRow`. Re-upload of the same `external_row_id` that previously failed re-tries; succeeded rows are no-ops.**
- B. Hash of (projectName + address) — derived, no template column.
- C. No idempotency; user must dedupe manually.

### Q7 — Excel parser library & file caps (US-2.4 / NFR-3.2)
- A. **`exceljs` (already commonly used in NestJS). 2 MB cap, max 200 rows per upload (one batch). Parse fully in-memory; fail-fast on missing headers; per-row errors collected and returned as a structured response.**
- B. `xlsx` (SheetJS) — slightly faster but heavier deps.
- C. CSV instead of Excel.

### Q8 — Frontend wizard structure (US-2.1)
- A. **Single lazy-loaded route `/projects/register` with a Material `mat-stepper` (steps: 1 Rating system & membership · 2 Project details · 3 Building info · 4 Owner info · 5 Address · 6 Agreement · 7 Fees & payment choice · 8 Confirmation). Wizard state held in a `RegistrationStore` (Signals) with `sessionStorage` persistence keyed on `draft:registration`. Edit-after-registration uses a separate `/projects/:projectId/edit` page (re-using the same step components in “edit mode”).**
- B. Multi-route wizard (one route per step).
- C. Single long form (no stepper).

---

## Approval gate

After your answers, I will (in one wave):
1. Generate `aidlc-docs/construction/unit-3-registration-fees/functional-design/{domain-entities,
   business-rules, business-logic-model, frontend-components}.md`.
2. Generate `aidlc-docs/construction/plans/unit-3-registration-fees-code-generation-plan.md`
   (numbered, checkboxed, story coverage table, PBT compliance note — same shape as the U2 plan).
3. Mark this batched plan’s checklist complete and update `aidlc-state.md`.

> Tests remain skipped per the documented U1 PBT deviation. PBT-01 (property identification) will
> still happen for the pure `FeeCalculator` and the `BulkRegistrationParser` round-trip property,
> so tests can be added later without rework.

---

## Part 2 generation checklist (filled in after answers)

- [ ] FD: `domain-entities.md` — Project, CertificationAgreement, Invoice, BulkRegistrationBatch, BulkRegistrationRow, FeeSchedule.
- [ ] FD: `business-rules.md` — BR-P (project), BR-A (agreement), BR-F (fees), BR-I (invoice), BR-N (project number), BR-B (bulk), BR-E (email), BR-Z (state-lock forward-compat).
- [ ] FD: `business-logic-model.md` — register flow (orchestrator), pay/commit flow, bulk-upload flow, edit flow, PBT-01 properties for `FeeCalculator` and `BulkRegistrationParser`.
- [ ] FD: `frontend-components.md` — registration wizard, fees panel, invoice view, agreement modal, bulk upload page, edit-project page, project-info-panel becomes editable.
- [ ] Plan: `unit-3-registration-fees-code-generation-plan.md` — numbered backend + frontend + docs + validation steps; story coverage table.
- [ ] State: mark U3 FD ✅ in `aidlc-state.md`; NFR Reqs/Design rows show `—  (skipped per user direction; carried from U1/U2)`.
- [ ] Audit: log this batched plan + the user’s answers + the deviation.

