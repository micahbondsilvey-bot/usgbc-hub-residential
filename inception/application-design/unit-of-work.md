# Units of Work — GBCI Certify: LEED Residential

**Decomposition basis** (from `unit-of-work-plan.md`): Q1=A application-design module map; Q2=A keep
9 units; Q3=A backend + matching frontend slice in the same unit; Q4=A standard shared concerns
(DTOs, audit interceptor, RBAC guards, provider seams), no events module; Q5=A single team; Q6=A
deploy together (2-service monolith pair); Q7=A adopt the proposed build sequence; Q8=A restructure
in place + new frontend folder.

## Services (deployables)
- **`usgbc-hub-residential-be`** (NestJS) — single deployable backend service hosting all backend
  modules and orchestrators.
- **`usgbc-hub-residential-fe`** (Angular 21 PWA) — single deployable frontend service hosting all
  feature areas, lazy-loaded by route.
- Each unit below contributes both a backend module and a matching frontend feature slice.

## Brownfield Code Organization (Q8=A)
- Restructure the existing backend in place. New backend module folders live under
  `usgbc-hub-residential-be/src/<unit>/` (e.g., `src/projects/`, `src/scorecard/`, `src/review/`).
- The existing `auth/` and `users/` folders are reworked under Unit 1 to support hybrid RBAC and
  four roles; `common/` (logger, middleware, exception filter), `config/`, and `health/` stay where
  they are and are reused.
- The new frontend lives at `usgbc-hub-residential-fe/` (Angular 21 standalone app). Inside, feature
  areas are organized as `src/app/features/<unit>/` mirroring backend units, with shared types/API
  client under `src/app/core/` and `src/app/shared/`.

## Unit Catalog

### Unit 1 — Platform Foundation
- **Goal**: Establish hybrid RBAC (global + per-project), audit trails, demo seed; rework existing
  auth/users.
- **Backend modules**: `AuthModule`, `UsersModule`, `MembershipModule`, `AuditModule` (+ retain
  `CommonModule`, `ConfigModule`, `HealthModule`).
- **Frontend feature**: `core/` (auth interceptor, route guards), `features/auth/` (login, profile).
- **Stories**: US-1.1, US-1.2, US-1.3, US-1.4, US-2.6 (invite — membership pieces), US-11.1, US-11.3.
- **Build order**: 1.

### Unit 2 — LEED Catalog & Scorecard
- **Goal**: Real LEED v4.1 SF catalog + per-project scorecard with live summary (PBT-target calculator).
- **Backend modules**: `CatalogModule`, `ScorecardModule`.
- **Frontend feature**: `features/scorecard/` (category/credit tree, point entry, live summary, view tabs).
- **Stories**: US-3.1, US-3.2, US-3.3, US-3.4, US-3.5, US-3.6.
- **Build order**: 2.

### Unit 3 — Project Registration & Fees
- **Goal**: Individual + bulk registration, fee logic, invoice (paid/unpaid), payment intent,
  GBCI-Certify project number after pay/commit, registration-confirmation email; post-registration
  edits and invites.
- **Backend modules**: `ProjectsModule`, `FeesModule` (+ `RegistrationOrchestrator`).
- **Frontend feature**: `features/registration/` (wizard, fee/invoice view, agreement, bulk upload).
- **Stories**: US-2.1, US-2.2, US-2.3, US-2.4, US-2.5, US-2.6 (UI side; membership in U1).
- **Build order**: 3.

### Unit 4 — Workbook
- **Goal**: Scorecard↔workbook binding; field verification, submittals (local S3-compatible storage),
  three-column notes (Green Rater / Provider QC / Reviewer).
- **Owns these features (where to look first)**: **Field Verification**, **Submittals (file uploads)**,
  **Verification Notes (Green Rater / Provider QC / Reviewer columns)**, plus the binding from the
  Scorecard's "Attempted" toggle to the workbook's auto-generated slots. Activates the three
  scorecard view-tabs that ship disabled in Unit 2.
- **Backend modules**: `WorkbookModule` + `FileStorageProvider` seam (local impl).
- **Frontend feature**: `features/workbook/` (three-section credit detail, uploads, notes).
- **Stories**: US-4.1, US-4.2, US-4.3, US-4.4, US-4.5.
- **Build order**: 4.

### Unit 5 — Review Workflow & State-Locking
- **Goal**: Phase-based review (prelim before final, final skippable), credit decisions/awards,
  auto-generated review report, return-to-reviewer-first then green-rater, accept/continue,
  authoritative quality score (revisable), state-lock enforcement.
- **Backend modules**: `ReviewModule` (incl. `StateLockService`, `ReviewReportService`,
  `QualityScoreService`) + `SubmissionOrchestrator`, `ReviewReturnOrchestrator`.
- **Frontend feature**: `features/review/` (decisions/award, report, return flow, accept/continue).
- **Stories**: US-7.1, US-7.3, US-7.4, US-7.6, US-7.7, US-11.2.
- **Build order**: 5.

### Unit 6 — Portfolio
- **Goal**: Anchor designation, hierarchy, portfolio dashboard, batch submit with anchor-failure-cascades.
- **Backend modules**: `PortfolioModule` + `PortfolioSubmissionOrchestrator`.
- **Frontend feature**: `features/portfolio/` (anchor designation, portfolio dashboard, batch submit).
- **Stories**: US-5.1, US-5.2, US-5.3, US-7.2.
- **Build order**: 6.

### Unit 7 — Dashboards & Notifications
- **Goal**: Role-tailored dashboards, admin pipeline + reviewer assignment, mocked notifications
  (review returned, submission confirmed, assignment received, payment due, registration confirmation).
- **Backend modules**: `DashboardModule`, `NotificationModule` + `NotificationProvider` seam.
- **Frontend feature**: `features/dashboard/` (4 role views), `features/notifications/`.
- **Stories**: US-7.8, US-10.1, US-10.2, US-10.3, US-10.4, US-10.5.
- **Build order**: 7.

### Unit 8 — Mocked AI
- **Goal**: AI-assisted submission and reviewer pre-review behind the AI seam, async in-process with
  status polling, human acknowledge/ignore.
- **Backend modules**: `AiModule` + `AiInsightProvider` seam (mock).
- **Frontend feature**: `features/ai/` (run check, "Analyzing…" state, insights/attention flags).
- **Stories**: US-6.1, US-8.1.
- **Build order**: 8.

### Unit 9 — Mobile/PWA & Scheduling
- **Goal**: Responsive PWA polish (large touch targets, installable), mobile field tools (camera +
  client-side compression), MS Bookings link-out (mock).
- **Backend modules**: `SchedulingModule` + `SchedulingProvider` seam.
- **Frontend feature**: PWA service worker + manifest, mobile-aware layouts, camera capture component.
- **Stories**: US-7.5, US-9.1, US-9.2, US-9.3.
- **Build order**: 9.

## Shared Concerns (Q4=A)
Used by every unit, not a unit themselves:
- **Shared DTOs/types** (`src/shared/` backend; `src/app/shared/` frontend).
- **Audit interceptor / entity subscriber** (provided by Unit 1).
- **Auth + project-role guards** (provided by Unit 1).
- **Provider seam interfaces** (`PaymentProvider`, `FileStorageProvider`, `NotificationProvider`,
  `AiInsightProvider`, `SchedulingProvider`) — declared centrally; mock implementations live with
  the owning unit.
- **CommonModule** (logger with masking, request/response middleware, global exception filter).
- **ConfigModule**, **HealthController**.

## Validation
- Every story (Epics 1–11) is assigned to exactly one unit (see `unit-of-work-story-map.md`).
- Build order is monotonic with dependencies (see `unit-of-work-dependency.md` — no cycles).
- All four personas are exercised across units 3–9.
- Mocked/deferred seams (AI, Storage, Notification, Payment, Scheduling) are isolated per Q4=A.
