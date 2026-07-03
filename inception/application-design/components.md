# Application Design — Components

High-level component identification for the GBCI Certify LEED Residential platform. Detailed business
rules are deferred to Functional Design (per unit). Backend = NestJS modules; Frontend = Angular 21
PWA feature areas. Decisions reflect plan answers: Q1=C (hybrid auth), Q2=A (in-process async AI),
Q3=A (relational catalog), Q4=A (provider-interface seams), Q5=A (`/api/v1` + Swagger), Q6=A
(standalone + Signals), Q7=A (orchestration services), Q8=A (1:1 module/unit alignment — assumed,
Q8 left blank).

## Authorization Model (Q1=C — Hybrid)
- **Global role** on the user account: primarily for **Admin** (platform-wide) and authentication.
- **Per-project membership**: a `ProjectMembership` links a user to a project with a project-scoped
  role (Project Team, Green Rater, Reviewer). Authorization = global Admin OR matching project role.
- Admin bypasses state-locks and has global read/write.

---

## Backend Components (NestJS modules)

### Unit 1 — Platform Foundation

#### AuthModule
- **Purpose**: Authenticate users; issue/verify tokens; enforce auth + RBAC.
- **Responsibilities**: Login (local JWT), token resolution, global `JwtAuthGuard`, `RolesGuard`
  extended for project-scoped roles, `@Roles`/`@ProjectRoles`/`@Public` decorators.
- **Interfaces**: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, guards/decorators consumed app-wide.

#### UsersModule
- **Purpose**: User identity and global role.
- **Responsibilities**: CRUD users, profile (name, org, Green Rater credential ID), password hashing,
  seed demo accounts.
- **Interfaces**: `UsersService`; `User` entity.

#### MembershipModule
- **Purpose**: Project-scoped roles and invitations.
- **Responsibilities**: Create/list memberships, invite users to a project with a project role,
  resolve a user's role on a given project.
- **Interfaces**: `ProjectMembershipService`; `ProjectMembership`, `Invitation` entities;
  `POST /api/v1/projects/:id/invitations`, `GET /api/v1/projects/:id/members`.

#### AuditModule
- **Purpose**: Cross-cutting audit trail.
- **Responsibilities**: Stamp `created_at`/`updated_at`/`modified_by`; record status/score/note changes.
- **Interfaces**: `AuditService`; audit interceptor/subscriber; base audit columns mixin.

#### CommonModule (existing, retained)
- **Purpose**: Logging (with masking), request/response middleware, global exception filter, config.

### Unit 2 — LEED Catalog & Scorecard

#### CatalogModule
- **Purpose**: Real LEED v4.1 SF rating system (relational, Q3=A).
- **Responsibilities**: Model and seed rating systems, categories, credits, prerequisites, point values;
  expose catalog for scorecard rendering.
- **Interfaces**: `CatalogService`; `RatingSystem`, `CreditCategory`, `Credit`, `CreditPointValue`
  entities; `GET /api/v1/catalog/rating-systems/:id`.

#### ScorecardModule
- **Purpose**: Per-project scorecard state and summary.
- **Responsibilities**: Attempted toggles, Attempted/Verified/Awarded point entries, live summary +
  certification-level derivation (pure calculator — PBT target), flag-but-allow-override on out-of-range.
- **Interfaces**: `ScorecardService`, `ScorecardSummaryCalculator` (pure); `ScorecardEntry` entity;
  `GET/PUT /api/v1/projects/:id/scorecard`.

### Unit 3 — Project Registration & Fees

#### ProjectsModule
- **Purpose**: Project registration and lifecycle.
- **Responsibilities**: Individual + bulk (Excel) registration, agreement record (name + date),
  GBCI-Certify project-number generation (post-payment), post-registration edits, status field.
- **Interfaces**: `ProjectsService`, `ProjectNumberGenerator`, `BulkRegistrationParser`;
  `Project`, `CertificationAgreement` entities; `POST /api/v1/projects`, `POST /api/v1/projects/bulk`.

#### FeesModule
- **Purpose**: Fee logic, invoicing, payment intent.
- **Responsibilities**: Compute fees (pure — PBT target), record pay-now/pay-later intent, generate
  invoice (paid/unpaid); payment processing deferred via `PaymentProvider` seam.
- **Interfaces**: `FeeCalculator` (pure), `InvoiceService`, `PaymentProvider` (seam, mock);
  `Invoice` entity; `GET /api/v1/projects/:id/invoice`.

### Unit 4 — Workbook

#### WorkbookModule
- **Purpose**: Field verification, submittals, three-column notes; scorecard↔workbook binding.
- **Responsibilities**: Auto-generate slots on attempt, field-verification inputs/calculators,
  named submittal slots with uploads, Green Rater / Provider QC / Reviewer note columns with
  per-column save + timestamp + author.
- **Interfaces**: `WorkbookService`, `FileStorageProvider` (seam, local S3-compatible);
  `FieldVerificationEntry`, `Submittal`, `VerificationNote` entities;
  `GET/PUT /api/v1/projects/:id/workbook/...`, `POST .../submittals`.

### Unit 5 — Review Workflow & State-Locking

#### ReviewModule
- **Purpose**: Phase-based review, decisions, report, scores, state-lock.
- **Responsibilities**: Submit-for-review (phase rules: prelim before final, final skippable),
  credit-by-credit decisions + award (award-all-verified), auto-generate review report, return to
  reviewer first then green rater, accept/continue, submittal quality score (authoritative on entry,
  revisable), state-lock enforcement (`UNDER_REVIEW`).
- **Interfaces**: `ReviewService`, `ReviewReportService`, `QualityScoreService`, `StateLockService`;
  `Review`, `ReviewPhase`, `CreditDecision`, `QualityScore` entities;
  `POST /api/v1/projects/:id/submit`, `POST .../reviews/:rid/decisions`, etc.

### Unit 6 — Portfolio

#### PortfolioModule
- **Purpose**: Simplified portfolio anchoring and batch submit.
- **Responsibilities**: Designate anchor, self-referencing hierarchy (`parent_anchor_id`), portfolio
  dashboard data, batch submit with **anchor-failure-cascades-to-children**.
- **Interfaces**: `PortfolioService`; uses `Project` + orchestration; `POST /api/v1/portfolios/:id/submit`.

### Unit 7 — Dashboards & Notifications

#### DashboardModule
- **Purpose**: Role-tailored aggregated views.
- **Responsibilities**: Project, Green Rater (quality score/trend, outstanding items), Reviewer
  (queue), Admin (pipeline + assignment) aggregations.
- **Interfaces**: `DashboardService`; `GET /api/v1/dashboard/{project|green-rater|reviewer|admin}`.

#### NotificationModule
- **Purpose**: Event notifications (mocked delivery).
- **Responsibilities**: Create/store notifications (review returned, submission confirmed, assignment,
  payment due, registration confirmation); deliver via `NotificationProvider` seam (logged/mock).
- **Interfaces**: `NotificationService`, `NotificationProvider` (seam); `Notification` entity.

### Unit 8 — Mocked AI

#### AiModule
- **Purpose**: AI-assisted submission + reviewer pre-review (mocked).
- **Responsibilities**: Run completeness/consistency/pre-review checks asynchronously (in-process,
  Q2=A) with status polling; store `AiInsight` results; human acknowledge/ignore; never auto-approve.
- **Interfaces**: `AiInsightService`, `AiInsightProvider` (seam, mock); `AiInsight` entity;
  `POST /api/v1/projects/:id/ai/checks`, `GET .../ai/checks/:checkId`.

### Unit 9 — Mobile/PWA & Scheduling

#### SchedulingModule
- **Purpose**: MS Bookings scheduling (mocked/link-out).
- **Responsibilities**: Generate/stub a booking link for reviewer↔green-rater calls; record on project.
- **Interfaces**: `SchedulingProvider` (seam, mock); `POST /api/v1/projects/:id/scheduling`.
- (Mobile/PWA is primarily a frontend concern — see frontend components.)

---

## Frontend Components (Angular 21 PWA — Q6=A)

- **Core/Shared**: typed `ApiClient` services per backend domain, generated models/DTotypes, auth
  interceptor, route guards (global + project-role), Angular Material theme (`--usgbc-*` tokens),
  Signals-based stores.
- **AuthFeature**: login, profile.
- **DashboardFeature**: project / green-rater / reviewer / admin dashboards (role-routed).
- **RegistrationFeature**: individual + bulk registration wizard, fee/invoice view, agreement.
- **ScorecardFeature**: category/credit tree, toggles, point entry, live summary bar, view tabs.
- **WorkbookFeature**: three-section credit detail (field verification, submittals upload, notes).
- **ReviewFeature**: reviewer decisions/award, report, return flow, accept/continue, scores.
- **PortfolioFeature**: anchor designation, portfolio dashboard, batch submit.
- **NotificationsFeature**: in-app notification list.
- **AiFeature (mocked)**: run check, "Analyzing…" state, insights/attention flags display.
- **Mobile/PWA**: responsive layouts, installable PWA, camera capture + client-side compression.

> All standalone components, lazy-loaded by feature route, state via Signals, calling the typed API client.
