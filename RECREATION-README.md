# USGBC Hub Residential (GBCI Certify) — Recreation

This repository was recreated from the AI-DLC design documents in `inception/` and
`construction/`. The original code lived on another machine and was not part of the handoff, so the
two applications below were rebuilt from the specifications.

## What's here now

| App | Path | Stack | Status |
|---|---|---|---|
| Backend | `usgbc-hub-residential-be/` | NestJS 9 · TypeORM · PostgreSQL · Redis | **Units 1–7 complete** |
| Frontend | `usgbc-hub-residential-fe/` | Angular 20.2 (standalone + Signals) | **Units 1–7 complete** |

**Unit 1 (Platform Foundation)** implements: email/password login (JWT HS256, 8h), hybrid RBAC
(global Admin + per-project roles), profile management, password reset + email verification
(one-time hashed tokens, mocked email), project memberships + token invitations with full lifecycle,
audit base columns + append-only `audit_log`, per-IP throttling (Redis-backed, fail-open), and a
demo user seed.

**Unit 2 (LEED Catalog & Scorecard)** implements: a data-driven LEED v4.1 SF catalog
(rating system → categories → credits → tiers) seeded idempotently from
`scripts/seed/leed-v41-sf-catalog.json` with integrity + certification-level validation; a per-project
scorecard with independent Attempted/Verified/Awarded columns, prerequisite lock-on, override-friendly
out-of-range warnings (values persist, never clamped), tiered-credit selection, and column-level
write permissions; a pure summary calculator (mirrored backend + frontend) deriving the certification
level; and a demo project (`RES-DEMO-001`) pre-seeded into the Silver band. Frontend adds a
Signal-based scorecard store, live summary bar, view tabs (only "All" enabled until Unit 4), and an
editable credit tree.

**Unit 3 (Project Registration & Fees)** implements: the real `Project` entity (replacing the Unit 2
demo placeholder) with a status state machine (DRAFT→REGISTERED→…); a transactional
`RegistrationOrchestrator` that signs a certification agreement (name snapshotted at signing),
computes a fee from a seeded `FeeSchedule` via a pure `FeeCalculator`, generates an `Invoice`
(`INV-######` sequence, mock `PaymentProvider` for pay-now/pay-later), then allocates the
`RES-######` project number and initializes the scorecard; a bulk Excel upload (`exceljs`, 2 MB/200-row
caps, per-row idempotency keyed on `external_row_id`); post-registration edits with a fee-field guard;
withdrawal; and a best-effort registration-confirmation email. Frontend adds a consolidated
registration form with a live fee quote, a projects list, a project detail page (info + invoice +
agreement + withdraw), and a bulk-upload page.

**Unit 4 (Workbook)** implements: a data-driven workbook catalog (field definitions + submittal-slot
definitions per credit) seeded from `scripts/seed/leed-v41-sf-workbook.json`; eager materialization of
per-project field entries + submittal slots when a credit is attempted (via a neutral
`WorkbookAttemptHookRegistry` the scorecard notifies — no circular dependency) and soft-archive on
un-attempt; typed field entries with a pure derived-field `formulaRegistry` (density + threshold
formulas), override-friendly range warnings; a `FileStorageProvider` seam with a
`LocalDiskStorageProvider`, upload/download (short-lived signed-token URLs)/delete with a 25 MB cap and
MIME allowlist; three-column verification notes (Green Rater / Provider QC / Reviewer) with per-column
write permissions; and per-credit "populated" flags for the view tabs. Frontend adds a workbook page
grouping fields by area, submittal upload/download, and the three-column notes editor.

**Unit 5 (Review Workflow & State-Locking)** implements: phase-based reviews (`PRELIMINARY → FINAL →
SUPPLEMENTAL`) with a `REV-######` sequence and a pure review status state machine; submit-for-review
that flips the project to `UNDER_REVIEW`; reviewer award decisions (strict `0 ≤ awarded ≤ verified`)
and award-all-verified; confirm that runs a pure Markdown report generator, derives the outcome
(PASSED / PASSED_WITH_ISSUES / DENIED) and certification level, and stores the report; return that lifts
the lock; accept-certification and continue-to-next-phase; a revisable submittal quality score; and an
Admin reviewer-assignment shortcut. Critically, it **replaces the `StateLockService` stub with the real
`UNDER_REVIEW` write-lock** (Admin + Reviewer bypass; Project Team / Green Rater blocked) that Units 2–4
now enforce, and extends the project status machine with the return/accept transitions. Frontend adds a
review page with submit, reviewer actions, report viewing, quality score, and accept/continue.

**Unit 6 (Portfolio)** implements (no new tables — extends `Project` with `isPortfolioAnchor` and
reuses `parentAnchorId`): anchor designation with a depth-1 hierarchy enforced by a pure
`assertHierarchy` invariant plus DB FK/CHECK constraints; attach/detach of children; a portfolio
dashboard with per-project scorecard rollups and latest-review joins; a pure combined fee quote
(skips already-paid registrations); and batch submit with the **anchor-first cascade** (anchor failure
skips all children) and **independent children** (each child's outcome depends only on its own state),
reusing an extracted `assertSubmittable` from Unit 5. Frontend adds a portfolio page with the dashboard,
anchor designation, attach/detach, fee quote, and batch-submit results.

**Unit 7 (Dashboards & Notifications)** implements: a persistent per-recipient `notification` table
wrapping the U1 mock gateway, driven by a pure `resolveRecipients` fan-out (FL-15) and a pure body/link
builder, with in-fire idempotence, per-recipient read state, unread count, and cursor pagination — fired
from the migrated Unit 1/3/5/6 call sites (invitation, registration, review submitted/returned, reviewer
assigned, portfolio batch completed) via a global `NotificationsService`. Plus role-scoped dashboards
(Project Team, Green Rater with workbook progress, Reviewer grouped by review status) and an Admin
pipeline with a pure monotone filter (FL-17) and cursor pagination. Frontend adds a polling notification
bell, a combined role-aware dashboard page, and the admin pipeline table.

Units 8–9 (mocked AI, mobile/PWA) are **not yet built** — their design docs are in `construction/` and
are ready to generate next.

## Prerequisites (developer machines)

- **Node.js** — backend 20.13.1+, frontend 20.19.0 (see `usgbc-hub-residential-fe/.nvmrc`)
- **Docker** — for local PostgreSQL + Redis

> Note: this folder is under OneDrive. Before running, copy or move both app folders to a local path
> outside OneDrive — OneDrive sync interferes with `node_modules` and dev servers.

## Run it

```bash
# Backend
cd usgbc-hub-residential-be
copy .env.example .env      # (already created)
npm install
npm run db:up               # starts Postgres (5433) + Redis (6379) via Docker
npm run start:dev           # http://localhost:3000  ·  Swagger at /api-docs

# Frontend (separate terminal)
cd usgbc-hub-residential-fe
npm install
npm start                   # http://localhost:4200
```

### Seeded demo accounts

| Email | Password | Global role |
|---|---|---|
| `admin@residential.test` | `Admin123!` | admin |
| `team@residential.test` | `Team123!` | user |
| `rater@residential.test` | `Rater123!` | user |
| `reviewer@residential.test` | `Reviewer123!` | user |

## Deviations from the original build (documented)

The recreation follows the specs faithfully. A few pragmatic engineering choices differ from the
original file-by-file summary, chosen for reliability of a fresh handoff:

1. **Audit stamping** uses a TypeORM `EntitySubscriber` (`audit-stamp.subscriber.ts`) plus the
   `AuditStampHelper` for system writes, rather than a controller interceptor. The subscriber is the
   idiomatic, reliable way to stamp `createdBy`/`updatedBy` on every insert/update regardless of the
   write path, and it satisfies the same BR-X1/BR-X2 contract.
2. **Frontend UI** uses clean reactive-form components with lightweight SCSS instead of Angular
   Material. Behavior, validation, routing, and the Signals-based state match the spec; Material
   theming can be layered in without structural change. The Unit 2 scorecard's smaller sub-components
   (category-row, credit-row, project-info-panel, attempted-toggle) are consolidated into the
   scorecard page template; the summary bar, view tabs, point cell, store, and pure calculator are
   separate per the spec.
3. **Global guards** (`JwtAuthGuard`, `ProjectRolesGuard`, `ThrottlerGuard`) are registered as
   `APP_GUARD` in `app.module.ts` for deterministic ordering.
4. **Angular 20.2** is used (matching `tech-stack-decisions.md`) rather than 21, since the Angular 21
   CLI requires Node ≥ 20.19.

## Verification status

The code was hand-written from the specs and has **not been compiled or run in this environment**
(Node.js/Docker are not installed here). Before relying on it, run `npm install` + `npm run build`
in each app on a machine with the prerequisites and resolve any environment-specific issues.

## Tests

Per the original AI-DLC decision, test cases are skipped in this build (documented PBT deviation);
`fast-check` is declared as a dependency in both apps and the pure calculators/validators are written
to be property-testable when tests are added.
