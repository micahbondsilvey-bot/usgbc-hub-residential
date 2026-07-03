# Personas — GBCI Certify: LEED Residential

Detail level: **Standard** (role, goals, key permissions, devices, frequency, pain points, success
metrics). Permissions reflect the approved requirements, including the expanded capabilities.

---

## P1 — Priya, the Project Team Member
- **Role**: Project Team (builder/owner representative registering a home for LEED certification).
- **Goals**: Register a project quickly, understand fees, track certification progress, view results,
  invite teammates, and accept the certification outcome.
- **Key Permissions**: R/W on project registration (incl. edit details after registration, except
  fee-related fields); invite users to the project; read-only on the workbook, review comments, and
  the auto-generated report; pay / choose pay-later; accept certification or continue to next phase.
- **Devices**: Primarily desktop; occasional tablet.
- **Frequency**: Bursts at registration and at review-return; otherwise periodic status checks.
- **Pain Points**: Fragmented email/spreadsheet process today; unclear status and fees; not knowing
  what's outstanding.
- **Success Metrics**: Time-to-registration, clarity of status, fewer back-and-forth emails.

---

## P2 — Greg, the Green Rater / Provider
- **Role**: Green Rater / Provider — the primary submitter who performs field verification and
  assembles the application.
- **Goals**: Complete field verification (often on-site/mobile), upload evidence per credit, run an
  AI completeness/consistency check before submitting, submit for review, manage portfolio
  associations, and track his quality score.
- **Key Permissions**: R/W on workbook and submissions; register a project and pay on behalf of the
  Project Team; edit registration details after registration; invite users to the project; run AI
  pre-review (completeness/consistency) analysis; submit/batch-submit for review; **read-only** on
  reviewer comments and the auto-generated report (cannot add/edit reviewer comments).
- **Devices**: Mobile/tablet in the field (camera upload, low connectivity); desktop for assembly.
- **Frequency**: Heavy daily use during active projects.
- **Pain Points**: Manual document handling; finding out about missing evidence only after review;
  no instant feedback on quality score; poor field connectivity.
- **Success Metrics**: Reduced RFIs, faster submission, mobile usability, instant quality feedback.

---

## P3 — Rosa, the Reviewer
- **Role**: GBCI Reviewer evaluating submissions and awarding points.
- **Goals**: Work through an assigned queue, run AI pre-review to focus attention, make credit-by-
  credit decisions, award points, auto-generate the review report, return results, schedule a call
  if needed, and record a submittal quality score.
- **Key Permissions**: Read on workbooks; R/W on review decisions and AI reviewer flags; initiate
  auto-generation of the review report (not upload); add internal review notes/comments; enter
  submittal quality score; schedule MS Bookings call (mocked/link-out); edit registration details.
- **Devices**: Desktop.
- **Frequency**: Daily during review cycles.
- **Pain Points**: Manual prep, inconsistent submissions, time spent finding what to examine, writing
  reports from scratch.
- **Success Metrics**: Review cycle time, consistency, time saved via AI attention flags and
  auto-generated report.

---

## P4 — Amir, the GBCI Admin
- **Role**: GBCI administrator overseeing the pipeline and operations.
- **Goals**: See the full project pipeline, assign reviewers, manage project status, confirm Green
  Rater quality scores, and unblock projects when necessary.
- **Key Permissions**: Global R/W; assign reviewers; manage/override project status (bypass
  state-locks); input/confirm Green Rater quality scores; edit registration details.
- **Devices**: Desktop.
- **Frequency**: Daily oversight.
- **Pain Points**: No single pipeline view today; manual assignment and status tracking; quality
  scores managed outside the system.
- **Success Metrics**: Pipeline visibility, assignment speed, accurate status, elimination of periodic
  manual quality-score reporting.

---

## Persona → Feature Participation (summary)

| Feature Area | P1 Project Team | P2 Green Rater | P3 Reviewer | P4 Admin |
|---|---|---|---|---|
| Account & Profile | ✔ | ✔ | ✔ | ✔ |
| Project Registration | ✔ (R/W) | ✔ (on behalf) | edit details | edit details |
| Scorecard | view | R/W | view | view |
| Workbook (verify/submittals/notes) | view | R/W | view + reviewer notes | view |
| Portfolio | ✔ | ✔ | view | view |
| AI-Assisted Submission (mocked) | — | ✔ | — | — |
| Review Workflow | accept/continue | submit | decide/award/report | assign/status |
| AI-Assisted Review (mocked) | — | ✔ (pre-review) | ✔ | — |
| Dashboards | project | green-rater | reviewer | pipeline |
| Mobile field tools | limited | ✔ | — | — |
