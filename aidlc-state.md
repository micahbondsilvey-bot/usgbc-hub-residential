# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield
- **Start Date**: 2026-06-24T00:00:00Z
- **Current Stage**: CONSTRUCTION - **Units 1–9 complete** (FD only for U3..U9; NFRR/NFRD skipped per user); ready for Build and Test phase
- **Workspace Root**: `/Users/hbayyapu/usgbc-hub-residential`

## Local Stack (running)
- Backend (NestJS) — `http://localhost:3000` · API base `/api/v1` · Swagger `/api-docs`
- Frontend (Angular 20.2 PWA) — `http://localhost:4200`
- PostgreSQL — `localhost:5433` (Docker via Colima)
- Redis — `localhost:6379` (Docker via Colima; backs the throttler)
- Node pin: backend Node 20.13.1; frontend Node 20.19.0 via `usgbc-hub-residential-fe/.nvmrc`

## Extension Configuration
| Extension | Enabled | Mode | Decided At |
|---|---|---|---|
| Security Baseline | No | - | Requirements Analysis |
| Resiliency Baseline | No | - | Requirements Analysis |
| Property-Based Testing | Yes | Full enforcement (PBT-01, PBT-09 COMPLIANT; PBT-02..08, PBT-10 deferred per documented test-skip deviation) | Requirements Analysis |

## Reference Documentation
- LEED Residential certification documents in `docs/` (rating system PDF, verification submittals worksheet, agreement, QA/Certification manuals).
- Reverse engineering artifacts: `aidlc-docs/inception/reverse-engineering/`.

## Code Location Rules
- **Application Code**: Workspace root (`usgbc-hub-residential-be/`, `usgbc-hub-residential-fe/`).
- **Documentation only**: `aidlc-docs/`.

---

## Inception Progress

| Stage | Status | Artifact |
|---|---|---|
| Workspace Detection | ✅ | `aidlc-docs/aidlc-state.md` |
| Reverse Engineering | ✅ | `aidlc-docs/inception/reverse-engineering/` |
| Requirements Analysis | ✅ | `aidlc-docs/inception/requirements/requirements.md` |
| User Stories | ✅ | `aidlc-docs/inception/user-stories/{stories,personas}.md` |
| Workflow Planning | ✅ | `aidlc-docs/inception/plans/execution-plan.md` |
| Application Design | ✅ | `aidlc-docs/inception/application-design/` |
| Units Generation | ✅ | `aidlc-docs/inception/application-design/{unit-of-work,unit-of-work-dependency,unit-of-work-story-map}.md` |

## Construction Progress

Per-unit loop is **batched** for U2..U9 (FD + NFRR + NFRD generated in one wave per unit, then
Code Generation). Tests are skipped consistent with the documented PBT deviation.

| Unit | Build Order | FD | NFR Reqs | NFR Design | Code Gen | Notes |
|---|---|---|---|---|---|---|
| **1 — Platform Foundation** | 1 | ✅ | ✅ | ✅ | ✅ | Hybrid RBAC, audit, demo seed, throttler |
| **2 — LEED Catalog & Scorecard** | 2 | ✅ | ✅ | ✅ | ✅ | Real LEED v4.1 SF catalog, override-friendly scorecard |
| **3 — Project Registration & Fees** | 3 | ✅ | — (skipped) | — (skipped per user) | ✅ | Real `Project`/`Invoice`/`CertificationAgreement` + bulk Excel; `RES-100001+` post-pay/commit; verified end-to-end |
| **4 — Workbook** | 4 | ✅ | — (skipped) | — (skipped per user) | ✅ | Field Verification + Submittals (local storage seam) + 3-column notes + scorecard ↔ workbook auto-bind; verified end-to-end |
| **5 — Review Workflow & State-Locking** | 5 | ✅ | — (skipped) | — (skipped per user) | ✅ | Phase-based review + auto-generated Markdown report + state-lock real impl + accept/continue + quality score; verified end-to-end |
| **6 — Portfolio** | 6 | ✅ | — (skipped) | — (skipped per user) | ✅ | Anchor designation + hierarchy + portfolio dashboard + batch submit (anchor-failure cascade + independent children) |
| **7 — Dashboards & Notifications** | 7 | ✅ | — (skipped) | — (skipped per user) | ✅ | Role-scoped dashboards (PT/GR/Reviewer/Admin) + persistent notification framework (mocked delivery) + admin quality-score revise UI |
| **8 — Mocked AI** | 8 | ✅ | — (skipped) | — (skipped per user) | ✅ | `AiInsightProvider` seam (mock) + async runs (QUEUED → RUNNING → COMPLETED/FAILED, 2s poll) + per-credit findings (MISSING_EVIDENCE / INSUFFICIENT_EVIDENCE / CROSS_CREDIT_CONTRADICTION / ATTENTION_FLAG) with human ack/ignore; embedded on Workbook (PRE_SUBMISSION) + Review (PRE_REVIEW); FL-18 + FL-19 pure subjects |
| **9 — Mobile/PWA & Scheduling** | 9 | ✅ | — (skipped) | — (skipped per user) | ✅ | Installable PWA (manifest + cache-first service worker; `/api/*` bypass) + responsive polish (44px touch targets, ≤600px / ≤900px breakpoints) + camera capture with client-side Canvas compression on Workbook submittals + `SchedulingProvider` seam (mock MS Bookings link-out) on returned reviews; FL-20 + FL-21 pure subjects |
| Infrastructure Design | n/a | — | — | — | — | **SKIPPED** (local-only this build) |
| Build and Test | n/a | — | — | — | — | Runs once after all units |

---

## Feature → Unit Map (where does X land?)

A single discoverable index so contributors can answer "which unit owns X?" without spelunking.
Source of truth is `aidlc-docs/inception/application-design/unit-of-work-story-map.md`; this is a
condensed view.

| Feature / capability | Unit | Status |
|---|---|---|
| Email/password login + JWT | U1 Foundation | ✅ |
| Hybrid RBAC (global Admin + per-project roles) | U1 Foundation | ✅ |
| Project memberships + invitations | U1 Foundation | ✅ |
| Audit base columns + `audit_log` | U1 Foundation | ✅ |
| Per-IP throttling on auth endpoints (Redis-backed) | U1 Foundation | ✅ |
| Demo accounts + `RES-DEMO-001` placeholder | U1 / U2 | ✅ |
| LEED v4.1 SF rating system catalog (categories, credits, prereqs, tiers) | U2 Catalog | ✅ |
| Project scorecard (Attempted/Verified/Awarded, override-friendly) | U2 Scorecard | ✅ |
| Live summary bar + certification level (Certified/Silver/Gold/Platinum) | U2 Scorecard | ✅ |
| View-tab placeholders ("All" enabled, others disabled until U4) | U2 Scorecard | ✅ |
| Project registration (individual + bulk Excel upload) | U3 Registration & Fees | ✅ |
| Fee logic + invoice + registration-confirmation email | U3 Registration & Fees | ✅ |
| GBCI-Certify project number generation (after pay/commit) | U3 Registration & Fees | ✅ |
| Real `Project` entity replaces the placeholder used by U2's demo | U3 Registration & Fees | ✅ |
| Editable project-info panel (read-only in U2) | U3 Registration & Fees | ✅ (project detail page) |
| Invite UI (acceptance landed in U1; project-side invite flow) | U3 Registration & Fees | ✅ |
| **Field Verification (inline inputs, calculators, area-tagged groups)** | **U4 Workbook** | ✅ |
| **Submittals (named upload slots, file storage seam, time-stamped saves)** | **U4 Workbook** | ✅ |
| **Three-column verification notes (Green Rater / Provider QC / Reviewer)** | **U4 Workbook** | ✅ |
| Scorecard ↔ Workbook binding (toggle attempted ⇒ auto-create slots) | U4 Workbook | ✅ |
| Activates the disabled scorecard view-tabs from U2 | U4 Workbook | ✅ (tabs enabled; FE filtering deferred) |
| Submit-for-review with phase rules (prelim before final; final skippable) | U5 Review | ✅ |
| Reviewer credit-by-credit decisions + award all verified | U5 Review | ✅ |
| Auto-generated review report; return-to-reviewer-first then green-rater | U5 Review | ✅ |
| Submittal Quality Score (authoritative on entry; revisable) | U5 Review | ✅ |
| State-locking (`UNDER_REVIEW`) — replaces U2's stub | U5 Review | ✅ |
| Accept certification or continue to next phase | U5 Review | ✅ |
| Portfolio anchor designation + hierarchy + dashboard | U6 Portfolio | ✅ |
| Batch submit (anchor failure cascades to children) | U6 Portfolio | ✅ |
| Project / Green Rater / Reviewer / Admin dashboards | U7 Dashboards & Notifications | ✅ |
| Admin pipeline view + reviewer assignment | U7 Dashboards & Notifications | ✅ |
| Admin input/revise quality scores | U7 Dashboards & Notifications | ✅ |
| Notification framework (mocked delivery): review returned, submission confirmed, etc. | U7 Dashboards & Notifications | ✅ |
| AI-assisted completeness/consistency check (mocked, async) | U8 Mocked AI | ✅ |
| Reviewer pre-review attention flags (mocked) | U8 Mocked AI | ✅ |
| PWA polish (service worker, manifest, mobile field tools) | U9 Mobile/PWA & Scheduling | ✅ |
| MS Bookings link-out (mocked) | U9 Mobile/PWA & Scheduling | ✅ |
| Camera capture + client-side image compression | U9 Mobile/PWA & Scheduling | ✅ |

---

## Plans
- Execution plan: `aidlc-docs/inception/plans/execution-plan.md`
- Per-unit code-generation plans: `aidlc-docs/construction/plans/`
- Per-unit design artifacts: `aidlc-docs/construction/<unit-name>/{functional-design, nfr-requirements, nfr-design, code}/`

## Audit Log
Complete chronological record of every stage transition, user input, and AI response is in
`aidlc-docs/audit.md`.
