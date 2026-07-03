# Requirements — GBCI Certify: LEED Residential

## Intent Analysis

- **User Request**: Use AI-DLC with the LEED Residential documentation in `docs/` to build the GBCI
  Certify platform. The LEED material defines business logic ("what"); the existing
  `usgbc-hub-residential-be` backend and the GBCI Certify HTML prototype represent a candidate
  solution ("how").
- **Request Type**: New Project / major feature build (extends a brownfield auth prototype).
- **Scope Estimate**: System-wide (multi-component: backend + frontend, full certification lifecycle).
- **Complexity Estimate**: Complex (rich domain logic, scorecard math, review state machine, portfolio
  hierarchy, mocked AI, file uploads, real LEED v4.1 SF credit catalog).
- **Requirements Depth**: Comprehensive.

## Guiding Principle (from Q1)

Build a **production-quality foundation that is also demo-ready**. Use clean, real implementations
for core domain logic and data, and **mock or defer** the externally-dependent pieces (AI, payments,
email delivery, cloud storage) behind well-defined interfaces so they can be made real later without
rework. "Mock any data or implementation necessary" to keep the system demonstrable end-to-end.

## Scope Decisions (from answers)

| # | Decision | Answer |
|---|---|---|
| Q1 | Primary goal | Hybrid: production-grade foundation + working demo; mock where necessary |
| Q2 | Components this build | Backend (NestJS) + Frontend (Angular 21 PWA). No separate Python AI service. |
| Q3 | Existing prototype | Reference it, but restructure as needed to match the Technical Design |
| Q4 | Feature scope | ALL "initial build" feature areas from the Features draft |
| Q5 | AI features | In scope but MOCKED (stubbed responses now, real LLM later) |
| Q6 | LEED domain data | Model the REAL LEED v4.1 SF credit structure from provided docs/worksheet |
| Q7 | Deployment target | Local-only (Docker Compose); no cloud/IaC this build |
| Q8 | Document storage | S3-compatible abstraction with a LOCAL backend now; S3 later |
| Q9 | Notifications | Notification framework built; delivery logged/mocked now |
| Q10 | Payments | Deferred; capture pay-now/pay-later choice only, plus fee logic display |
| Ext | Security baseline | OFF |
| Ext | Resiliency baseline | OFF |
| Ext | Property-based testing | ON — full enforcement (all PBT rules blocking) |

## Personas / Roles (target = four roles)

- **Project Team**: Register project and pay, track credits, view status and review results (read-only on workbook). Invite users to project. Can edit registration details after registration.
- **Green Rater / Provider**: Primary submitter — edit workbook/verification, upload docs per credit,
  run AI completeness/consistency check, mark ready, submit for review, view quality dashboard,
  manage portfolio/production associations. Register project, pay on behalf of project team. Can edit registration details after registration. Invite users to project. Green Rater/Provider can also run AI pre-review analysis. Green Rater/Providers do not have access to add or edit reviewer comments. They have read-only access to reviewer comments and auto-generated report.
- **Reviewer**: View assigned projects, run AI pre-review analysis, enter credit-by-credit decisions,
  award points, initiate auto-generation of review report, add internal notes, enter submittal quality score. Review report should be auto-generated, not uploaded. Can edit registration details after registration.
- **Admin (GBCI)**: Full project pipeline visibility, assign reviewers, manage project status,
  input/confirm Green Rater quality scores, bypass state-locks. Can edit registration details after registration.

> Note: The existing prototype models three roles (`project_team`, `green_rater`, `reviewer_admin`).
> This build splits Reviewer and Admin into distinct roles to match the Features/Technical drafts.

---

## Functional Requirements

### FR-1 Account Management
- FR-1.1 Email/password registration and login.
- FR-1.2 Role assignment at account creation or by Admin.
- FR-1.3 Basic profile: name, organization, Green Rater credential ID (for Green Raters).
- FR-1.4 Password reset and email verification (delivery mocked/logged per Q9).
- FR-1.5 Pre-seeded demo accounts for each role for stakeholder presentations.
- Out of scope: SSO, LEED Online identity federation, external credential-registry verification.

### FR-2 Project Registration
- FR-2.1 Rating system selection: LEED Residential v4.1 Single Family.
- FR-2.2 Individual project or Bulk registration option.
- FR-2.3 Capture: membership level, project details, building information, owner information,
  project address with geolocation.
- FR-2.4 Certification agreement click-through; preserve a date-stamped agreement record that also captures the signing user's name.
- FR-2.5 Pay-now (credit card) or pay-later choice captured, with fee logic computed/displayed;
  **actual card payment deferred** (Q10) — record the choice and generate an invoice (paid or unpaid).
  Paying or committing to pay later is the gate that triggers project-number generation (FR-2.7).
  After registration + invoice generation, send a registration-confirmation email delivering the
  invoice (delivery logged/mocked per Q9).
- FR-2.6 Bulk registration via standardized Excel upload (parse → validate → create projects). When
  some rows succeed and others fail validation, a corrected re-upload creates only the failed/new
  rows without producing duplicate records (idempotent on a stable row identifier).
- FR-2.7 Generate a unique GBCI-Certify project number (e.g., `RES-100045`) **after** payment/commitment
  and invoice generation (FR-2.5), distinct from SAP ID format; persist a nullable `sap_project_id`
  placeholder for future integration.
- FR-2.8 Post-registration edit of fields (except fee-related), view invoice and signed agreement.
- Out of scope: other LEED for Homes products, SAP number generation, auto membership-level logic.

### FR-3 Scorecard & Credit Tracking
- FR-3.1 Credit-category rows with LEED category icon badges, expandable to reveal credits.
- FR-3.2 Points available shown at credit, category, and all-categories levels.
- FR-3.3 Per-credit "Attempted" toggle for optional credits; prerequisites shown as toggles locked in the On position (no separate lock icon).
- FR-3.4 Point-entry columns per credit: Attempted, Verified, Awarded. Out-of-range/invalid entries are flagged to the user but may be overridden (not rejected).
- FR-3.5 Live summary bar: Attempted / Verified / Awarded totals with derived certification level.
- FR-3.6 View-tab filtering: All / Field Verification / Submittals / Verification Notes.
- FR-3.7 Expandable project-info panel with editable fields and live summary display.
- FR-3.8 Real LEED v4.1 SF credit catalog (categories, credits, prerequisites, point values) seeded
  from the provided rating system + verification submittals worksheet.

### FR-4 Application / Workbook
- FR-4.1 Three-section credit detail panel: Field Verification, Submittals, Verification Notes.
- FR-4.2 Field Verification: inline inputs, calculators, area-tagged verification groups.
- FR-4.3 Submittals: named document upload slots with contextual requirement notes; saved with
  time/date stamp (storage via local S3-compatible abstraction per Q8).
- FR-4.4 Verification Notes: three-column layout (Green Rater / Provider QC / Reviewer) with per-column Save
  and timestamp.
- FR-4.5 Section-level collapse/expand within each credit detail.
- FR-4.6 View tabs open only prerequisites and attempted credits in the relevant section.
- FR-4.7 Scorecard↔Workbook binding: toggling a credit to "Attempted" auto-generates the
  corresponding Field Verification and Submittal slots.

### FR-5 Batch / Portfolio (Simplified)
- FR-5.1 Portfolio anchor designation: any registered project can be a portfolio anchor whose credit
  elections, documentation, and review outcomes can be inherited by child projects.
- FR-5.2 Portfolio dashboard: view all child projects under/attached to an anchor.
- FR-5.3 Certification: pay and submit all projects together for certification.
- FR-5.4 Self-referencing project hierarchy via nullable `parent_anchor_id`.
- Out of scope: credit-level inheritance, bulk inheritance toggle, child project partial submission,
  AI drift detection, full Production Builder model.

### FR-6 AI-Assisted Submission (Customer / Green Rater side) — MOCKED
- FR-6.1 Completeness check: reviews uploaded docs against credit requirements; flags missing/insufficient evidence.
- FR-6.2 Consistency check: identifies contradictions across credits (e.g., conflicting square footage).
- FR-6.3 Suggested actions: specific, actionable callouts (not just a flag).
- FR-6.4 Implemented behind an `AiInsightProvider` interface returning realistic stubbed results;
  processed asynchronously with an "Analyzing submission…" state; results stored in an `ai_insights`
  store and surfaced as suggested actions. Human-in-the-loop: AI never auto-approves.

### FR-7 Application Submission & Review Workflow
- FR-7.1 Review phases: Preliminary and Final, with optional Supplemental. Preliminary must precede
  Final — a project with no completed Preliminary review cannot proceed to Final. Final may be
  skipped when the Preliminary review awarded everything required (project certified at Preliminary).
- FR-7.2 Submit-for-review action with phase selection and fee confirmation (fee logic; payment deferred).
- FR-7.3 Batch submit-for-review. For a portfolio, a failure at the anchor project fails all of its
  child projects; independent projects transition individually with per-project error reporting.
- FR-7.4 State-locking: on submit, project flips to `UNDER_REVIEW`; backend rejects Project Team /
  Green Rater writes for that project until the review is returned. Admin can bypass locks.
- FR-7.5 Reviewer interface: credit-by-credit decisions adding Awarded points; "award all verified
  points" one-click action.
- FR-7.6 Review results are returned to the Reviewer first for review/confirmation of the
  auto-generated report and comments, then released to the Green Rater with consolidated results and
  comments. Afterward, the Reviewer schedules a call via MS Bookings with the Green Rater if required
  to review results and close outstanding issues. (MS Bookings scheduling is a mocked/link-out
  integration this build — generate/stub a booking link behind an interface; real integration deferred.)
- FR-7.7 Project Team / Green Rater response: accept certification or continue to next phase.
- FR-7.8 Reviewer entry of Submittal Quality Score. The score is authoritative once the Reviewer
  enters it (feeds the Green Rater dashboard immediately) and can later be revised by a Reviewer or
  an Admin (FR-10.5); revisions are audit-tracked.
- FR-7.9 Email notifications: review returned, submission confirmed, assignment received, payment due
  (framework built; delivery mocked/logged per Q9).

### FR-8 AI-Assisted Review (Reviewer side) — MOCKED
- FR-8.1 Pre-review analysis: same completeness/requirements check surfaced from the reviewer's view.
- FR-8.2 Attention flags: specific credits/items to examine closely, each with a plain-language reason.
- FR-8.3 Implemented via the same mocked AI interface as FR-6.
- Out of scope: overall confidence score, precedent surfacing, report drafting assistance, portfolio delta review.

### FR-9 Mobile Experience
- FR-9.1 Fully responsive PWA layout optimized for phone and tablet.
- FR-9.2 Green Rater field verification checklist with optional camera/photo upload.
- FR-9.3 Mobile-accessible Green Rater dashboard.
- FR-9.4 Large touch targets and minimal scrolling to reach primary actions.
- FR-9.5 Client-side image compression before upload to save bandwidth in low-connectivity field use.

### FR-10 Dashboards
- FR-10.1 Project dashboard: active projects with status indicators, current phase, attention flags.
- FR-10.2 Green Rater dashboard: personal quality score and trend, project history with outcomes,
  outstanding items across active projects, credential/CE status.
- FR-10.3 Reviewer dashboard: assigned reviews and reviews they were invited to.
- FR-10.4 Admin pipeline view: full project queue with reviewer assignments and status.
- FR-10.5 Admin input/revision of Green Rater quality scores: GBCI staff can view authoritative
  reviewer-entered scores and revise them, or input a score where a Reviewer has not entered one.
  Changes take effect immediately on the Green Rater dashboard and are audit-tracked.

### FR-11 Roles & Access Control
- FR-11.1 Four roles (Project Team, Green Rater, Reviewer, Admin) with RBAC enforced at the API.
- FR-11.2 Access matrix: Project Team R/W on registration, R on review results; Green Rater R/W on
  workbooks/submissions; Reviewer R on workbooks, R/W on review decisions and AI reviewer flags;
  Admin global R/W and bypasses state-locks.

---

## Non-Functional Requirements

### NFR-1 Architecture & Tech Stack
- NFR-1.1 Backend: Node.js 20.13.1+ with NestJS (TypeScript), modular architecture, DTO validation
  (class-validator), Swagger/OpenAPI, health checks, structured logging.
- NFR-1.2 Frontend: Angular 20.2 (standalone components, signals, lazy-loaded routing), Angular
  Material 20 + CDK, SCSS with `--usgbc-*` theme tokens, mobile-first responsive, PWA. Pinned to
  20.2 because Angular 21's CLI requires Node ≥ 20.19; the frontend folder pins Node 20.19 via
  `.nvmrc` while the backend keeps Node 20.13.1. Move to Angular 21 when the team adopts a
  Node ≥ 20.19 baseline platform-wide.
- NFR-1.3 Database: PostgreSQL (relational; required for portfolio hierarchy, roles, fee logic, scoring).
- NFR-1.4 Storage: S3-compatible abstraction with a local backend now (e.g., local disk/MinIO),
  accessed via presigned-URL-style API; swappable to AWS S3 later.
- NFR-1.5 Decoupled data models and API boundaries so deferred integrations (LEED Online, SAP, Arc)
  can be added without core refactoring.

### NFR-2 Data Modeling Standards
- NFR-2.1 Internal UUIDs for all projects; display a generated GBCI-Certify-ID; nullable
  `sap_project_id` column reserved.
- NFR-2.2 Portfolio: self-referencing project hierarchy via nullable `parent_anchor_id`.
- NFR-2.3 Audit trails: every submittal, note column, and status change carries DB-level
  `created_at`, `updated_at`, and `modified_by`.
- NFR-2.4 Rating system stored as a lookup table (not a hardcoded enum); scorecard structure stored
  relationally/JSON so future rating systems can be added via data.
- NFR-2.5 AI prompts/outputs decoupled from core code (stored in DB/config) for future GALE Phase 2.

### NFR-3 Core Workflow Constraints
- NFR-3.1 Live summary bar computes locally on the frontend for instant feedback, but final
  validation and point awarding are enforced authoritatively on the backend before DB commit.
- NFR-3.2 File uploads: max size (e.g., 50MB/file); allowed types PDF, Word (DOC/DOCX), PowerPoint
  (PPT/PPTX), Excel (XLS/XLSX), images (JPG/PNG/etc.), video, plain text (TXT), and Markdown (MD).
- NFR-3.3 AI checks run asynchronously (background worker pattern, e.g., BullMQ/Redis-style) with a
  skeleton "Analyzing…" UI state and polling/WebSocket notify; mocked provider returns promptly.
- NFR-3.4 AI is a co-pilot, never an auto-approver; outputs stored separately and explicitly
  acknowledged or ignored by a human.

### NFR-4 Quality, Testing & Tooling (PBT ENABLED — full enforcement)
- NFR-4.1 Property-based testing is a blocking constraint across applicable stages. Framework:
  **fast-check** (backend Jest; frontend Vitest). Testable properties must be identified during
  functional design and implemented during code generation. Example areas:
  - Scorecard invariants: `Awarded ≤ Verified ≤ Attempted`; category totals = Σ credit points;
    certification level correctly derived from point thresholds.
  - Excel bulk-upload parse/serialize round-trip.
  - Review workflow stateful properties: no command sequence yields an illegal state.
  - Fee logic invariants: non-negative; bounded discounts.
- NFR-4.2 PBT complements (does not replace) example-based tests for business-critical paths.
- NFR-4.3 Linting/formatting: ESLint + Prettier (single quotes, 100-char width); TypeScript strict.
- NFR-4.4 Tests run in CI-style scripts with seed logging for reproducibility.

### NFR-5 Security & Access (baseline extension OFF, core practices retained)
- NFR-5.1 RBAC enforced at the API for all protected routes (retain prototype's guard pattern).
- NFR-5.2 JWT-based auth (local provider now; structured to toggle Auth0/SSO later).
- NFR-5.3 Passwords hashed (bcrypt); DTO validation with whitelisting; Helmet headers; CORS to FE origin.
- NFR-5.4 Note: AWS security-baseline extension rules are NOT enforced this build (per opt-out).

### NFR-6 Deployment & Runtime
- NFR-6.1 Local-only via Docker Compose (PostgreSQL + app). No cloud provisioning/IaC this build.
- NFR-6.2 Demo environment: pre-seeded accounts/data and mocked AI for zero-latency presentations.
- NFR-6.3 Config is environment-driven and cloud-ready (storage/AI/email behind interfaces) to ease
  later AWS migration.

### NFR-7 Usability & Accessibility
- NFR-7.1 Mobile-first, progressive disclosure, clear status at every step.
- NFR-7.2 Accessible form controls/overlays via Angular Material + CDK; WCAG-minded components.

---

## Out of Scope (this build)

- Real LLM/AI microservice (Python FastAPI) and real RAG knowledge base.
- Real credit-card payment processing (Stripe) and real email delivery.
- AWS provisioning / IaC (Terraform/CDK), real S3 bucket.
- Integrations: LEED Online, Arc, Snowflake, Asana, SAP; SSO/identity federation.
- Credit-level portfolio inheritance, AI drift detection, full Production Builder model.
- Multi-program admin configurability (schema should not preclude it, but no UI/config now).
- Real MS Bookings integration (scheduling is mocked/link-out this build per FR-7.6); external Green Rater credential-registry verification.

## Key Requirements Summary

A local-runnable, demo-ready foundation for the full GBCI Certify LEED Residential initial-build
feature set: four-role RBAC, account management, project registration (individual + Excel bulk),
a real LEED v4.1 SF scorecard with deeply-bound workbook (field verification, submittals, three-column
notes), simplified portfolio anchoring, a phase-based review workflow with state-locking, mocked
AI-assisted submission and review, role dashboards, and a mobile-first Angular PWA — built on
NestJS + PostgreSQL with a swappable storage/AI/email/payment seam. Externally-dependent concerns are
mocked or deferred behind interfaces. Property-based testing is fully enforced; AWS security and
resiliency baselines are intentionally off.

## Traceability

Requirements derive from: `docs/GBCI_Certify_LEED_Residential_Features_draft.docx` (scope &
features), `docs/GBCI_Certify_LEED_Residential_Technical_Design_draft.docx` (stack & constraints),
LEED v4.1 SF Rating System and Verification Submittals Worksheet (domain data), and the existing
`usgbc-hub-residential-be` prototype (auth/RBAC reference). Answers captured in
`requirement-verification-questions.md`.
