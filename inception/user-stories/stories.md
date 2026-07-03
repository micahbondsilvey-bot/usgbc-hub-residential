# User Stories — GBCI Certify: LEED Residential

**Organization**: Hybrid — epics per feature area, each story tagged by persona.
**Granularity**: Medium (one user goal per story), INVEST-compliant.
**Acceptance Criteria**: Bullet checklist of conditions.
**Sequencing**: Each story carries a suggested **Build Order** (foundational → dependent).
**Mocked/deferred seams**: Stories describe only the behavior actually built this cycle (mocked where
applicable); the mock/deferral is stated in the criteria.
**Cross-cutting**: RBAC, state-locking, and audit trails are captured as separate stories (Epic 11).
**Traceability**: Each story references the originating FR/NFR IDs.

> All stories are written to satisfy INVEST (Independent, Negotiable, Valuable, Estimable, Small,
> Testable). Personas: P1 Project Team, P2 Green Rater, P3 Reviewer, P4 Admin.

---

## Epic 1 — Account Management & Profile (FR-1) — Build Order 2

### US-1.1 — Email/password registration & login
**Build Order**: 2 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-1.1, NFR-5.2, NFR-5.3
As a user, I want to register and log in with email and password so that I can securely access the platform.
- [ ] Given valid credentials, when I log in, then I receive a session/token and land on my role's dashboard.
- [ ] Given invalid credentials, when I log in, then I see a clear error and no session is created.
- [ ] Passwords are stored hashed (bcrypt); never returned by any API.
- [ ] Login input is validated (email format, password min length) with whitelisting.

### US-1.2 — Manage basic profile
**Build Order**: 3 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-1.3
As a user, I want to maintain my profile (name, organization, and Green Rater credential ID for raters) so that my identity and credentials are recorded.
- [ ] I can view and edit name and organization.
- [ ] Green Rater users have a credential ID field; other roles do not.
- [ ] Changes persist and are reflected immediately.

### US-1.3 — Password reset & email verification (mocked delivery)
**Build Order**: 4 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-1.4, FR-7.9, NFR-… (notifications)
As a user, I want to reset my password and verify my email so that I can recover access and confirm my identity.
- [ ] Requesting a reset generates a tokenized link; the email is logged/mocked (not actually sent this build).
- [ ] A valid reset token lets me set a new password; expired/used tokens are rejected.
- [ ] Email verification status is tracked on the account.

### US-1.4 — Pre-seeded demo accounts
**Build Order**: 1 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-1.5, NFR-6.2
As a presenter, I want pre-seeded demo accounts for each role so that stakeholder demos work instantly.
- [ ] On startup, one account per role (Project Team, Green Rater, Reviewer, Admin) is seeded/refreshed.
- [ ] Seeded credentials are configurable and documented.
- [ ] Seeded accounts have realistic profile data for demos.

---

## Epic 2 — Project Registration (FR-2) — Build Order 4

### US-2.1 — Register an individual project
**Build Order**: 4 · **Personas**: P1, P2 · **Traceability**: FR-2.1, FR-2.3, FR-2.4
As a Project Team member or Green Rater, I want to register a LEED v4.1 SF project so that it enters the certification pipeline.
- [ ] I select rating system "LEED Residential v4.1 Single Family".
- [ ] I capture membership level, project details, building info, owner info, and address with geolocation.
- [ ] I complete a certification-agreement click-through; a date-stamped agreement record with user name is preserved.
- [ ] On success, the project is created in a draft/registered state and visible on my dashboard.

### US-2.2 — Generate GBCI-Certify project number
**Build Order**: 5 · **Personas**: P1, P2 · **Traceability**: FR-2.7, NFR-2.1
As a user, I want each project to get a unique GBCI-Certify ID so that it is identifiable independent of SAP.
- [ ] The unique display ID (e.g., `RES-100045`) is generated **only after** the user pays or commits to pay later (invoice generated) — see US-2.3 — not at the start of registration.
- [ ] An internal UUID is the primary key; a nullable `sap_project_id` column is reserved.
- [ ] The display ID is distinct from SAP format, shown across the UI; collisions are impossible.

### US-2.3 — Capture payment/commitment, generate invoice & confirmation email (payment deferred)
**Build Order**: 4 · **Personas**: P1, P2 · **Traceability**: FR-2.5, FR-2.4, FR-2.7, (Q9, Q10)
As a registrant, I want to see computed fees and either pay or commit to pay later (generating an invoice) so that billing intent is recorded before my project number is issued.
- [ ] Fees are computed/displayed from fee logic based on registration inputs.
- [ ] I can select "pay now" or "pay later"; the choice is persisted.
- [ ] Actual card processing is deferred — "pay now" records intent and produces an invoice/agreement view (no real charge).
- [ ] Paying or committing to pay later **generates an invoice** (paid or unpaid) and is the gate that triggers GBCI-Certify project-number generation (US-2.2).
- [ ] After this initial registration + invoice generation, the user receives a registration-confirmation email delivering the invoice (paid or unpaid); email delivery is logged/mocked this build.
- [ ] The invoice and the signed agreement are viewable after registration.

### US-2.4 — Bulk register via Excel upload
**Build Order**: 6 · **Personas**: P1, P2 · **Traceability**: FR-2.6, NFR-3.2, NFR-4.1
As a registrant, I want to upload a standardized Excel file so that I can register many projects at once.
- [ ] I download/use a standardized template; uploading parses and validates rows.
- [ ] Valid rows create projects; invalid rows are reported with row-level errors and do not block valid ones.
- [ ] When some rows were ingested and others failed validation, the user can re-upload a corrected sheet and only the previously-failed/new rows are created — already-ingested rows do NOT produce duplicate records (idempotent re-upload keyed on a stable row identifier).
- [ ] Parsing is reversible/consistent (parse → model → re-serialize round-trips) — see PBT note.
- [ ] Allowed file type is Excel; size limit enforced.

### US-2.5 — Edit registration details post-registration
**Build Order**: 6 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-2.8 (expanded roles)
As any authorized role, I want to edit registration details after registration so that information stays accurate.
- [ ] All four roles can edit non-fee registration fields after registration.
- [ ] Fee-related fields are not editable post-registration.
- [ ] Edits are audit-tracked (who/when) per Epic 11.

### US-2.6 — Invite users to a project
**Build Order**: 6 · **Personas**: P1, P2 · **Traceability**: Personas (expanded), FR-11
As a Project Team member or Green Rater, I want to invite users to a project so that collaborators get appropriate access.
- [ ] I can invite a user by email and assign their project role.
- [ ] The invite is recorded; delivery email is logged/mocked this build.
- [ ] Invited users gain role-scoped access to that project only.

---

## Epic 3 — Scorecard & Credit Tracking (FR-3) — Build Order 3

### US-3.1 — Seed real LEED v4.1 SF credit catalog
**Build Order**: 1 · **Personas**: (system/data) P2, P3 · **Traceability**: FR-3.8, NFR-2.4, Q6=A
As the platform, I want the real LEED v4.1 SF catalog (categories, credits, prerequisites, point values) so that scorecards reflect the true rating system.
- [ ] Categories, credits, prerequisites, and point values are modeled from the provided rating system + verification submittals worksheet.
- [ ] The rating system is a lookup (not a hardcoded enum); scorecard structure is data-driven.
- [ ] Prerequisites are flagged distinctly from optional credits.

### US-3.2 — View scorecard with categories and credits
**Build Order**: 3 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-3.1, FR-3.2
As a user, I want to see credit-category rows with icons that expand to credits so that I can navigate the scorecard.
- [ ] Category rows show LEED category icon badges and expand to reveal credits.
- [ ] Points available are shown at credit, category, and all-categories levels.
- [ ] Prerequisites are shown as toggles locked in the On position (no separate lock icon); optional credits show a switchable attempted toggle.

### US-3.3 — Toggle attempted credits & enter points
**Build Order**: 4 · **Personas**: P2 · **Traceability**: FR-3.3, FR-3.4
As a Green Rater, I want to mark optional credits attempted and enter points so that I can build the application.
- [ ] I can toggle "Attempted" for optional credits; prerequisites are always required (toggle locked in the On position).
- [ ] Each credit exposes Attempted, Verified, Awarded entry columns per role permissions.
- [ ] Invalid point entries (out of the credit's available range) are identified/flagged to the user but can be overridden (not rejected).

### US-3.4 — Live summary bar with certification level
**Build Order**: 4 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-3.5, NFR-3.1, NFR-4.1
As a user, I want a live Attempted/Verified/Awarded summary with the derived certification level so that I always know where the project stands.
- [ ] The summary updates locally as values change (instant feedback).
- [ ] Certification level is derived from awarded-point thresholds (Certified/Silver/Gold/Platinum).
- [ ] Backend is authoritative: final totals/level are validated server-side before commit.
- [ ] PBT invariants: computed category total = Σ entered credit points; all-categories total = Σ category totals; certification level is correctly derived from awarded points for all inputs. (Per-credit point-range validity is flagged but overridable per US-3.3, so range conformance is advisory, not a hard invariant.)

### US-3.5 — Scorecard view-tab filtering
**Build Order**: 5 · **Personas**: P2, P3 · **Traceability**: FR-3.6, FR-4.6
As a user, I want to filter by All / Field Verification / Submittals / Verification Notes so that I can focus on one aspect.
- [ ] Selecting a view tab filters the visible credit content accordingly.
- [ ] View tabs open only prerequisites and attempted credits in the relevant section.

### US-3.6 — Editable project-info panel
**Build Order**: 5 · **Personas**: P1, P2 · **Traceability**: FR-3.7
As a user, I want an expandable project-info panel with editable fields so that I can manage project info alongside the live summary.
- [ ] The panel expands/collapses and shows the live summary.
- [ ] Editable fields respect role permissions and audit tracking.

---

## Epic 4 — Application / Workbook (FR-4) — Build Order 5

### US-4.1 — Scorecard↔Workbook binding
**Build Order**: 5 · **Personas**: P2 · **Traceability**: FR-4.7
As a Green Rater, I want attempting a credit to auto-generate its workbook slots so that the workbook always matches the scorecard.
- [ ] Toggling a credit to "Attempted" creates the corresponding Field Verification and Submittal slots.
- [ ] Un-attempting a credit removes/archives its slots without losing already-entered data unexpectedly (confirm prompt).

### US-4.2 — Field Verification section
**Build Order**: 5 · **Personas**: P2 · **Traceability**: FR-4.2
As a Green Rater, I want inline inputs, calculators, and area-tagged verification groups so that I can record field verification efficiently.
- [ ] Each attempted credit shows its Field Verification inputs grouped by area tag.
- [ ] Calculator fields compute derived values; results persist.
- [ ] Inputs validate types/ranges.

### US-4.3 — Submittals with named upload slots (local storage)
**Build Order**: 5 · **Personas**: P2 · **Traceability**: FR-4.3, NFR-1.4, NFR-3.2
As a Green Rater, I want named document upload slots with requirement notes so that I can attach the right evidence per credit.
- [ ] Each submittal slot has a name and contextual requirement note.
- [ ] Uploads accept PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Excel (XLS/XLSX), image files (JPG/PNG/etc.), video files, plain text (TXT), and Markdown (MD) within the size limit; disallowed types are rejected.
- [ ] Files are stored via an S3-compatible abstraction backed locally; retrieved via presigned-URL-style access.
- [ ] Each saved submittal records a time/date stamp.

### US-4.4 — Three-column verification notes
**Build Order**: 5 · **Personas**: P2, P3 · **Traceability**: FR-4.4, FR-11
As a user, I want Green Rater / Provider QC / Reviewer note columns with per-column save and timestamp so that each party records context.
- [ ] Three columns are shown (Green Rater, Provider QC, Reviewer); each saves independently with a timestamp and author.
- [ ] Green Raters can write the Green Rater column; Reviewers write the Reviewer column; permissions enforced.
- [ ] Green Raters have read-only access to the Reviewer column.

### US-4.5 — Section collapse/expand
**Build Order**: 6 · **Personas**: P2, P3 · **Traceability**: FR-4.1, FR-4.5
As a user, I want to collapse/expand the three sections within a credit detail so that I can manage screen space.
- [ ] Each of Field Verification, Submittals, Verification Notes collapses/expands independently.
- [ ] State is preserved while navigating within the workbook session.

---

## Epic 5 — Batch / Portfolio (Simplified) (FR-5) — Build Order 8

### US-5.1 — Designate a portfolio anchor
**Build Order**: 8 · **Personas**: P1, P2 · **Traceability**: FR-5.1, FR-5.4, NFR-2.2
As a registrant, I want to designate a project as a portfolio anchor so that child projects can attach to it.
- [ ] Any registered project can be designated an anchor.
- [ ] Projects use a self-referencing hierarchy via nullable `parent_anchor_id`.
- [ ] A child project references an anchor; an anchor lists its children.

### US-5.2 — Portfolio dashboard
**Build Order**: 8 · **Personas**: P1, P2 · **Traceability**: FR-5.2
As a registrant, I want to view all child projects under an anchor so that I can manage the portfolio.
- [ ] The portfolio dashboard lists all child projects with status.
- [ ] I can navigate from anchor to any child and back.

### US-5.3 — Pay & submit portfolio together
**Build Order**: 8 · **Personas**: P1, P2 · **Traceability**: FR-5.3, FR-7.3
As a registrant, I want to pay and submit all portfolio projects together so that I can certify them as a group.
- [ ] I can trigger a combined submit-for-review across the portfolio.
- [ ] Fee logic aggregates across the portfolio (payment intent only; processing deferred).

---

## Epic 6 — AI-Assisted Submission (Mocked) (FR-6) — Build Order 9

### US-6.1 — Run completeness & consistency check (mocked)
**Build Order**: 9 · **Personas**: P2 · **Traceability**: FR-6.1, FR-6.2, FR-6.3, NFR-3.3, NFR-3.4
As a Green Rater, I want to run an AI completeness/consistency check before submitting so that I can fix gaps early.
- [ ] Triggering the check runs asynchronously with an "Analyzing submission…" state and notifies on completion (poll/WebSocket).
- [ ] A mocked `AiInsightProvider` returns realistic results: missing/insufficient evidence flags and cross-credit contradictions.
- [ ] Each finding includes a specific, actionable suggested action (not just a flag).
- [ ] Results are stored in an `ai_insights` store; AI never auto-approves; I explicitly acknowledge or ignore each.

---

## Epic 7 — Submission & Review Workflow (FR-7) — Build Order 7

### US-7.1 — Submit for review with phase selection
**Build Order**: 7 · **Personas**: P2 · **Traceability**: FR-7.1, FR-7.2
As a Green Rater, I want to submit for review and pick the phase so that the application enters the right review stage.
- [ ] I can select Preliminary or Final (Supplemental optional) at submission.
- [ ] Preliminary must occur before Final: a project with no completed Preliminary review cannot be submitted for Final (Final is blocked/disabled until Preliminary is done).
- [ ] Final may be skipped when the Preliminary review already awarded everything required (project achieved certification at Preliminary) — the project can finalize without a Final phase.
- [ ] A fee confirmation step shows the review fee (intent only; payment deferred).
- [ ] Submission validates server-side before transitioning state.

### US-7.2 — Batch submit for review
**Build Order**: 8 · **Personas**: P2 · **Traceability**: FR-7.3
As a Green Rater, I want to submit multiple projects for review at once so that I can save time on portfolios.
- [ ] I can select multiple eligible projects and submit them together.
- [ ] For a portfolio, a failure at the anchor project fails all of its child projects (the batch does not partially submit children when their anchor fails).
- [ ] For independent (non-anchor) projects, each transitions individually; failures are reported per project without blocking the others.

### US-7.3 — Reviewer credit-by-credit decisions & award points
**Build Order**: 7 · **Personas**: P3 · **Traceability**: FR-7.5
As a Reviewer, I want to make credit-by-credit decisions and award points so that I can determine the outcome.
- [ ] I can set Awarded points per credit within the verified range.
- [ ] An "award all verified points" action sets Awarded = Verified across credits in one click.
- [ ] Awards are validated server-side (Awarded ≤ Verified) before commit (PBT invariant).

### US-7.4 — Auto-generate & return review report
**Build Order**: 7 · **Personas**: P3, P2 · **Traceability**: FR-7.6 (report auto-generated)
As a Reviewer, I want to auto-generate a review report and return results so that the Green Rater receives consolidated outcomes.
- [ ] I can initiate auto-generation of the review report (generated by the system, not uploaded).
- [ ] Results are returned to the Reviewer first for review/confirmation of the auto-generated report and comments, before being released to the Green Rater.
- [ ] After the Reviewer confirms, returning the review sends consolidated results and comments to the Green Rater.
- [ ] The Green Rater has read-only access to the returned comments and report.

### US-7.5 — Schedule review call via MS Bookings (mocked/link-out)
**Build Order**: 9 · **Personas**: P3, P2 · **Traceability**: FR-7.6
As a Reviewer, I want to schedule a call with the Green Rater so that we can resolve outstanding issues.
- [ ] After returning a review, I can trigger scheduling; a booking link is generated via a mocked/link-out integration.
- [ ] The scheduling action and link are recorded on the project; real MS Bookings integration is deferred.

### US-7.6 — Accept certification or continue to next phase
**Build Order**: 8 · **Personas**: P1, P2 · **Traceability**: FR-7.7
As a Project Team member or Green Rater, I want to accept the result or continue so that the project advances correctly.
- [ ] After a returned review, I can accept certification (finalizes) or continue to the next phase.
- [ ] The choice transitions project state accordingly and is audit-tracked.

### US-7.7 — Reviewer enters submittal quality score
**Build Order**: 8 · **Personas**: P3 · **Traceability**: FR-7.8, FR-10.4
As a Reviewer, I want to record a submittal quality score so that Green Rater quality can be tracked.
- [ ] I can enter a quality score on review; it persists with the project and Green Rater.
- [ ] The score becomes authoritative as soon as the Reviewer enters it and immediately feeds the Green Rater dashboard.
- [ ] The score can later be revised by a Reviewer or an Admin (see US-10.5); revisions are audit-tracked.

### US-7.8 — Workflow notifications (mocked delivery)
**Build Order**: 8 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-7.9, Q9
As a user, I want notifications for key events so that I stay informed.
- [ ] Events generate notifications: review returned, submission confirmed, assignment received, payment due.
- [ ] A notification framework records each notification; delivery is logged/mocked (not actually sent).
- [ ] Notifications are visible in-app where applicable.

---

## Epic 8 — AI-Assisted Review (Mocked) (FR-8) — Build Order 9

### US-8.1 — Reviewer pre-review analysis (mocked)
**Build Order**: 9 · **Personas**: P3, P2 · **Traceability**: FR-8.1, FR-8.2, FR-8.3
As a Reviewer (and Green Rater for pre-review), I want AI pre-review analysis so that I can focus on the right credits.
- [ ] Running pre-review surfaces the same mocked completeness/requirements findings from the reviewer's perspective.
- [ ] Attention flags list specific credits/items with a plain-language reason each.
- [ ] Findings reuse the shared mocked `AiInsightProvider`; results are advisory and human-acknowledged.
- [ ] Green Raters can also run pre-review (read-only on reviewer comments otherwise).

---

## Epic 9 — Mobile Experience (FR-9) — Build Order 10

### US-9.1 — Responsive PWA layout
**Build Order**: 10 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-9.1, FR-9.4, NFR-7
As a field user, I want a responsive PWA so that I can work on phone or tablet.
- [ ] Layouts adapt to phone/tablet with large touch targets and minimal scrolling to primary actions.
- [ ] The app is installable as a PWA.

### US-9.2 — Mobile field verification with camera upload
**Build Order**: 10 · **Personas**: P2 · **Traceability**: FR-9.2, FR-9.5
As a Green Rater in the field, I want a mobile checklist with camera upload so that I can verify on-site.
- [ ] The field verification checklist is usable on mobile.
- [ ] I can capture/upload photos from the device camera.
- [ ] Images are compressed client-side before upload to save bandwidth.

### US-9.3 — Mobile Green Rater dashboard
**Build Order**: 10 · **Personas**: P2 · **Traceability**: FR-9.3, FR-10.2
As a Green Rater, I want a mobile-accessible dashboard so that I can check status in the field.
- [ ] The Green Rater dashboard renders and functions on mobile.

---

## Epic 10 — Dashboards (FR-10) — Build Order 6

### US-10.1 — Project dashboard
**Build Order**: 6 · **Personas**: P1 · **Traceability**: FR-10.1
As a Project Team member, I want a dashboard of active projects so that I can track status and attention items.
- [ ] Shows active projects with status indicators, current phase, and flags for items needing attention.

### US-10.2 — Green Rater dashboard
**Build Order**: 6 · **Personas**: P2 · **Traceability**: FR-10.2
As a Green Rater, I want a dashboard with my quality score and outstanding items so that I can prioritize.
- [ ] Shows personal quality score and trend, project history with outcomes, outstanding items across active projects, and credential/CE status.

### US-10.3 — Reviewer dashboard
**Build Order**: 6 · **Personas**: P3 · **Traceability**: FR-10.3
As a Reviewer, I want a queue of assigned/invited reviews so that I can manage my workload.
- [ ] Shows all assigned reviews and reviews I was invited to, with status.

### US-10.4 — Admin pipeline view & assignment
**Build Order**: 6 · **Personas**: P4 · **Traceability**: FR-10.4, FR-7
As an Admin, I want a full pipeline view so that I can assign reviewers and manage status.
- [ ] Shows the full project queue with reviewer assignments and status.
- [ ] I can assign a reviewer to a project and change project status.

### US-10.5 — Admin inputs or revises Green Rater quality scores
**Build Order**: 8 · **Personas**: P4 · **Traceability**: FR-7.8, FR-10.5 (Admin function)
As an Admin, I want to input or revise Green Rater quality scores so that they stay accurate.
- [ ] I can view reviewer-entered scores (already authoritative) for any project/Green Rater.
- [ ] I can revise an existing score or input a score where a Reviewer has not entered one.
- [ ] Revisions take effect immediately on the Green Rater dashboard and are audit-tracked (who/when/old→new).

---

## Epic 11 — Cross-Cutting Concerns (FR-11, NFR-2.3, FR-7.4) — Build Order 1

### US-11.1 — Role-based access control (four roles)
**Build Order**: 1 · **Personas**: P1, P2, P3, P4 · **Traceability**: FR-11.1, FR-11.2, NFR-5.1
As the platform, I want RBAC enforced at the API so that each role can only do what it's permitted.
- [ ] Four roles exist: Project Team, Green Rater, Reviewer, Admin.
- [ ] Every protected route enforces role permissions per the access matrix; unauthorized access is rejected (403).
- [ ] Permission checks are centralized/declarative (guards), not scattered ad hoc.
- [ ] Admin has global access and can bypass state-locks.

### US-11.2 — Submission state-locking
**Build Order**: 7 · **Personas**: P2, P3, P4 · **Traceability**: FR-7.4
As the platform, I want projects locked during review so that data can't change mid-review.
- [ ] On submit, the project status flips to `UNDER_REVIEW`.
- [ ] While `UNDER_REVIEW`, Project Team and Green Rater write operations for that project are rejected.
- [ ] Admin can bypass the lock.
- [ ] On review return, the lock is released for permitted transitions.
- [ ] Stateful invariant: no sequence of operations leaves a project in an illegal/locked-but-editable state (PBT).

### US-11.3 — Audit trails & timestamps
**Build Order**: 2 · **Personas**: (all) · **Traceability**: NFR-2.3
As the platform, I want audit fields on key records so that changes are traceable.
- [ ] Every submittal, note column, and status change records `created_at`, `updated_at`, and `modified_by`.
- [ ] Audit fields are set automatically and cannot be spoofed by clients.

---

## Coverage & Sequencing Summary

| Build Order | Stories | Theme |
|---|---|---|
| 1 | US-1.4, US-3.1, US-11.1 | Foundations: demo seed, LEED catalog, RBAC |
| 2 | US-1.1, US-1.2(3), US-11.3 | Accounts, profile, audit |
| 3 | US-1.2, US-3.2 | Profile, scorecard view |
| 4 | US-2.1, US-2.3, US-3.3, US-3.4 | Registration core, payment/invoice, point entry, summary |
| 5 | US-2.2, US-3.5, US-3.6, US-4.1–4.4 | Project number (post-payment), fees, workbook |
| 6 | US-2.4, US-2.5, US-2.6, US-4.5, US-10.1–10.4 | Bulk, edits, invites, dashboards |
| 7 | US-7.1, US-7.3, US-7.4, US-11.2 | Review workflow + state-lock |
| 8 | US-5.1–5.3, US-7.2, US-7.6, US-7.7, US-7.8, US-10.5 | Portfolio, batch, accept, scores, notifications |
| 9 | US-6.1, US-7.5, US-8.1 | Mocked AI, MS Bookings scheduling |
| 10 | US-9.1–9.3 | Mobile experience |

**Coverage check**: Every FR area (FR-1..FR-11) has ≥1 story; all four personas represented;
cross-cutting RBAC/state-locking/audit captured separately (Q6=A); mocked seams (AI, payments, email,
storage, MS Bookings) represented as the behavior built this cycle (Q5=B) with deferral noted.
