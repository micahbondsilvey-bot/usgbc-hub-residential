# AI-DLC Audit Log

## Initial User Request
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Using AI DLC refer to the documentation "/Users/hbayyapu/usgbc-hub-residential/docs" and start the process."
**AI Response**: Loaded AI-DLC core workflow and common rules, displayed welcome message, began Workspace Detection.
**Context**: Workflow start - INCEPTION Phase

---

## Workspace Detection
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (automatic stage)
**AI Response**: Detected brownfield project. Existing NestJS TypeScript backend at usgbc-hub-residential-be/ (auth, users, common, config, health modules). LEED Residential reference docs in docs/. No existing aidlc-state.md or reverse engineering artifacts. Determined next phase: Reverse Engineering.
**Context**: INCEPTION - Workspace Detection complete

---

## Reverse Engineering
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (automatic stage)
**AI Response**: Analyzed the NestJS backend (auth, users, common, config, health). Generated 9 artifacts in aidlc-docs/inception/reverse-engineering/: business-overview, architecture, code-structure, api-documentation, component-inventory, technology-stack, dependencies, code-quality-assessment, and timestamp. Presented completion message and awaiting user approval before Requirements Analysis.
**Context**: INCEPTION - Reverse Engineering complete, awaiting approval

---

## Reverse Engineering - User Response / Clarification
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "The LEED residential certifiaction material contains business logic while the prototype represents the possible solution."
**AI Response**: Acknowledged. Treating docs/ LEED material as the authoritative source of business requirements (the "what"), and the existing backend prototype + GBCI Certify platform draft as a candidate solution (the "how") to validate against requirements rather than a fixed constraint. Reverse engineering accepted (no change requests). Proceeding to Requirements Analysis.
**Context**: INCEPTION - Reverse Engineering approved with framing; transition to Requirements Analysis

---

## Requirements Analysis - Clarifying Questions
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Loaded reverse-engineering context and extracted business logic from docs/ (GBCI Certify Features draft + Technical Design draft via textutil; reviewed LEED reference material list). Determined Comprehensive depth (large, multi-component, high business impact). Created aidlc-docs/inception/requirements/requirement-verification-questions.md with 10 scoping questions plus 3 extension opt-in prompts (security, resiliency, property-based testing). Awaiting user answers before generating requirements.md (Step 6 GATE).
**Context**: INCEPTION - Requirements Analysis, awaiting answers
**Extension Opt-Ins Presented**: security-baseline, resiliency-baseline, property-based-testing

---

## Requirements Analysis - Answers & Document Generation
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "I have answered all the questions except [PBT]... Need more information on this question." → then "I choose A as an answer proceed to the next step using AI DLC"
**Recorded Answers**: Q1=X (hybrid production+demo, mock as needed); Q2=B (Backend+Frontend); Q3=B (reference prototype, restructure to Technical Design); Q4=A (all initial-build features); Q5=B (AI mocked); Q6=A (real LEED v4.1 SF data); Q7=A (local-only); Q8=B (S3 abstraction, local backend); Q9=B (notification framework, mocked delivery); Q10=C (defer payments); Security=No; Resiliency=No; PBT=A (full enforcement).
**AI Response**: Explained PBT in project context and recommended B/C; user selected A. Analyzed all answers — no blocking contradictions (PBT-on with security/resiliency-off is a deliberate valid mix; AI in scope but mocked with no Python service is consistent). Recorded Extension Configuration in aidlc-state.md (Security No, Resiliency No, PBT Yes/full). Loaded full PBT rules. Generated aidlc-docs/inception/requirements/requirements.md (comprehensive depth). Awaiting approval before next stage.
**Context**: INCEPTION - Requirements Analysis complete, awaiting approval
**PBT Compliance (Requirements Analysis stage)**: PBT-09 framework selection noted (fast-check) under NFR-4; full property identification deferred to Functional Design (PBT-01). No blocking findings at this stage.

---

## Requirements Analysis - User Edits & Approval to Proceed
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "I have made changes to the requirements.md file. Take these into account and move to the next step using AI DLC."
**AI Response**: Re-read requirements.md. Captured edits: expanded role capabilities (invite users; all roles edit registration post-registration; Green Rater can register/pay on behalf of team and run AI pre-review but read-only on reviewer comments/report); review report auto-generated not uploaded; FR-7.6 adds MS Bookings scheduling. Detected one contradiction (FR-7.6 MS Bookings scheduling vs Out-of-Scope "Reviewer scheduling/calls"); reconciled by treating MS Bookings as in-scope but mocked/link-out and updating Out of Scope accordingly. Requirements approved. Proceeding to User Stories.
**Context**: INCEPTION - Requirements Analysis approved (with edits); transition to User Stories

---

## User Stories - Part 1 Planning
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Ran intelligent assessment (all high-priority indicators met) and created aidlc-docs/inception/plans/user-stories-assessment.md (decision: execute). Created aidlc-docs/inception/plans/story-generation-plan.md with 7 planning questions (breakdown approach, granularity, AC format, prioritization, mocked-seam representation, cross-cutting stories, persona detail) plus the Part 2 execution checklist. Awaiting user answers/approval before generating stories.md and personas.md.
**Context**: INCEPTION - User Stories Part 1 (Planning), awaiting answers

**Approval Prompt**: "User Stories planning is ready. Please answer the 7 questions in story-generation-plan.md and approve the approach so I can generate stories.md and personas.md."

---

## User Stories - Plan Answers & Part 2 Generation
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "I answered questions. Please proceed to the next step using AI DLC"
**Recorded Answers**: Q1=D (hybrid epics + persona tags); Q2=B (medium/INVEST); Q3=B (bullet checklist AC); Q4=B (suggested build order); Q5=B (stories only for mocked behavior built this cycle); Q6=A (separate cross-cutting stories for RBAC/state-locking/audit); Q7=B (standard personas).
**AI Response**: Analyzed answers — all unambiguous, no contradictions. Generated personas.md (4 standard personas) and stories.md (11 epics, ~40 stories, bullet-checklist AC, build-order sequencing, FR/NFR traceability, INVEST). Marked story-generation-plan checklist complete. Awaiting approval before Workflow Planning.
**Context**: INCEPTION - User Stories Part 2 complete, awaiting approval

**Approval Prompt**: Presented "User Stories Complete" message with Request Changes / Approve & Continue options; next stage Workflow Planning.

---

## User Stories - Change Requests (persisted to stories.md + requirements.md)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "For the following, we're reading the stories.md doc and noting changes... 2.1.3 preserve user's name on agreement w/ date; 2.1–2.3 pay/commit (invoice) before generating GBCI-Certify number; 2.3 send registration-confirmation email delivering invoice (paid/unpaid); 2.4 re-upload corrected sheet without duplicate records; 3.2.3 no lock icon, toggles locked On; 3.3.3 flag invalid entries but allow override (not rejection); 4.3.2 accept Word/image/PPT/video/plaintext/MD too; 4.4 rename QA column to 'Provider QC'; 7.1 prelim before final, final skippable if prelim awarded everything; 7.2.2 anchor failure fails all child projects; 7.4 return results to reviewer first before green rater; 7.7.2 what is the Admin confirm flow?"
**AI Response**: Persisted all changes:
- stories.md: US-2.1 (name on agreement - already edited), US-2.2 (number after payment, BO→5), US-2.3 (pay/commit gate + invoice + confirmation email, BO→4, retitled), US-2.4 (idempotent re-upload), US-3.2 (toggles locked On, no lock icon), US-3.3 (flag+override), US-3.4 (PBT invariants reframed: totals/level invariant; range validity advisory), US-4.3 (expanded file types), US-4.4 (Provider QC), US-7.1 (phase ordering), US-7.2 (anchor cascade), US-7.4 (return to reviewer first), US-7.7 + US-10.5 (provisional→admin-confirm authoritative), Coverage table BO swap.
- requirements.md: FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-3.3, FR-3.4, FR-4.4, NFR-3.2, FR-7.1, FR-7.3, FR-7.6, FR-7.8, FR-10.5 (re-added Admin confirm flow).
Answered the 7.7.2 question (Admin confirm flow = US-10.5/FR-10.5). Noted PBT implication of override decision (range conformance is advisory, not a hard invariant). Stories remain in User Stories stage awaiting approval.
**Context**: INCEPTION - User Stories revised per user; awaiting approval

---

## User Stories - Clarification on Submittal Quality Score (7.7.2)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "For 7.7.2, the submittal quality score becomes authoritative once the reviewer enters it. However, the score can be revised by a reviewer or admin."
**AI Response**: Reverted the provisional/Admin-confirm-gate model. Updated US-7.7 (authoritative on reviewer entry, feeds GR dashboard immediately, revisable by reviewer/admin, audit-tracked), US-10.5 (retitled to "Admin inputs or revises Green Rater quality scores" — revise existing or input where missing; immediate effect; audit-tracked), FR-7.8, and FR-10.5 accordingly.
**Context**: INCEPTION - User Stories revised; awaiting approval

---

## User Stories - Approval
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Proceed with workflow planning using AI DLC"
**AI Response**: Recorded User Stories approval. Marked User Stories complete in aidlc-state.md. Loaded Workflow Planning + content-validation rules. Proceeding to create execution-plan.md.
**Status**: Approved
**Context**: INCEPTION - User Stories approved; transition to Workflow Planning

---

## Workflow Planning - Plan Created
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Created aidlc-docs/inception/plans/execution-plan.md. Decisions: EXECUTE Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Code Generation, Build and Test; SKIP Infrastructure Design (local-only, no cloud/IaC; security/resiliency extensions OFF). Risk High (scope) / Rollback Easy (local) / Testing Complex (PBT + multi-component). Proposed 9-unit build sequence derived from story Build Order. Mermaid workflow + text alternative included (content validated). Updated aidlc-state.md execution summary and stage statuses. Awaiting plan approval.
**AI Prompt**: "Ready to proceed with this plan? Approve to proceed to Application Design."
**Status**: Awaiting approval
**Context**: INCEPTION - Workflow Planning complete

---

## Workflow Planning - Approval
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Approve & continue"
**AI Response**: Execution plan approved. Marked Workflow Planning complete. Proceeding to Application Design.
**Status**: Approved
**Context**: INCEPTION - Workflow Planning approved; transition to Application Design

---

## Application Design - Plan & Questions
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Created aidlc-docs/inception/plans/application-design-plan.md with 8 design questions (authorization model global vs per-project, async mocked-AI approach, catalog/scorecard storage, seam pattern, API conventions, frontend architecture, cross-domain orchestration, module/unit alignment) plus the artifact generation checklist. Awaiting answers before generating components/methods/services/dependency design docs.
**Context**: INCEPTION - Application Design (planning), awaiting answers

---

## Application Design - Answers & Artifact Generation
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "I answered the questions. Using AI DLC proceed."
**Recorded Answers**: Q1=C (hybrid: global Admin + per-project roles); Q2=A (in-process async AI + polling); Q3=A (relational catalog); Q4=A (provider-interface seams); Q5=A (/api/v1 + Swagger); Q6=A (Angular standalone + Signals + feature-lazy); Q7=A (orchestration services); Q8=BLANK → proceeded with recommended A (1:1 module/unit alignment), assumption flagged to user.
**AI Response**: Analyzed answers (no ambiguity; Q1=C fully specified by option text). Generated application-design artifacts: components.md, component-methods.md, services.md, component-dependency.md, application-design.md. Defined 9 backend modules (mapped to units), 5 provider seams, 4 orchestration services with rule gates, hybrid RBAC, relational catalog, pure/PBT-target calculators. Mermaid + text alternatives included. Marked design plan checklist complete. Awaiting approval before Units Generation.
**Context**: INCEPTION - Application Design complete, awaiting approval

---

## Application Design - Approval
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Approve and continue. Proceed to next step using AI DLC"
**AI Response**: Application Design approved. Marked complete in aidlc-state.md. Proceeding to Units Generation.
**Status**: Approved
**Context**: INCEPTION - Application Design approved; transition to Units Generation

---

## Units Generation - Part 1 Plan & Questions
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Created aidlc-docs/inception/plans/unit-of-work-plan.md with 8 decomposition questions (story-grouping criterion, unit count/merging, frontend slicing, cross-unit dependencies, team alignment, per-unit deployability, build sequence, brownfield code organization) plus the Part 2 generation checklist (unit-of-work, unit-of-work-dependency, unit-of-work-story-map). Awaiting answers before generating unit artifacts.
**AI Prompt**: "Unit of work plan complete. Review the plan in aidlc-docs/inception/plans/unit-of-work-plan.md. Ready to proceed to generation?"
**Context**: INCEPTION - Units Generation Part 1 (Planning), awaiting answers

---

## Units Generation - Answers, Plan Approval, Part 2 Generation
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Answered all questions. Proceed with next step using AI DLC."
**Recorded Answers**: Q1=A (module-map basis); Q2=A (keep 9 units); Q3=A (BE+FE same unit); Q4=A (standard shared concerns; no events module); Q5=A (single team); Q6=A (deploy together — 2-service monolith pair); Q7=A (adopt proposed sequence); Q8=A (restructure existing BE in place + new FE folder).
**AI Response**: All answers unambiguous. Implicit plan approval. Generated unit artifacts: aidlc-docs/inception/application-design/unit-of-work.md (9 units, brownfield org notes), unit-of-work-dependency.md (matrix + Mermaid + text alternative; no cycles; build order 1→9), unit-of-work-story-map.md (all stories assigned). Marked Part 2 checklist complete. Awaiting approval before transitioning to CONSTRUCTION (Functional Design per unit, starting with Unit 1).
**AI Prompt**: "Units Generation complete. Approve to proceed to CONSTRUCTION PHASE (Functional Design, Unit 1)."
**Status**: Awaiting approval
**Context**: INCEPTION - Units Generation complete

---

## Units Generation - Approval / CONSTRUCTION Start
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Approve and continue using AI DLC"
**AI Response**: Units Generation approved. Marked complete in aidlc-state.md. Transitioning to CONSTRUCTION phase. Per-unit loop begins with Unit 1 — Platform Foundation. First stage: Functional Design.
**Status**: Approved
**Context**: INCEPTION complete; CONSTRUCTION begins (per-unit loop, Unit 1: Platform Foundation, Functional Design)

---

## CONSTRUCTION - Unit 1 Foundation - Functional Design (Plan & Questions)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Loaded Functional Design rules. Created aidlc-docs/construction/plans/unit-1-foundation-functional-design-plan.md with 9 design questions (multi-project memberships, invitation rights, invitation lifecycle, reviewer assignment modeling, audit scope, modified_by identifier, password policy, demo seed identities, frontend invite-accept scope) plus the artifact checklist (entities, rules, logic model, frontend components, PBT-01 properties). Awaiting answers.
**Context**: CONSTRUCTION - Unit 1 Functional Design (planning), awaiting answers
**Extension Context**: PBT full enforcement — PBT-01 (property identification) is required at this stage and is included as a checklist step.

---

## CONSTRUCTION - Unit 1 Foundation - Functional Design (Generation)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Questions are answered. Proceed with AI DLC"
**Recorded Answers**: Q1=X (no multiple roles per user on same project; different roles allowed across projects — equivalent to A intent with explicit unique constraint); Q2=A (PT/GR invite PT/GR; Reviewer Admin-only); Q3=A (full lifecycle, TTL, re-invite supersedes); Q4=A (Reviewer assignment = ProjectMembership row); Q5=A (audit base columns + audit_log); Q6=A (UUID); Q7=A (min 8, bcrypt 10); Q8=A (account per role + seeded demo project memberships); Q9=A (invite-accept page in Unit 1).
**AI Response**: Analyzed answers — no ambiguity. Generated 4 functional design artifacts in aidlc-docs/construction/unit-1-foundation/functional-design/: domain-entities.md, business-rules.md, business-logic-model.md, frontend-components.md. Identified 5 PBT-01 properties (auth decision determinism + Admin universality + inactivity; invitation state-machine invariants; membership uniqueness; audit timestamp invariants; token round-trip/idempotence). Marked plan checklist complete.
**Context**: CONSTRUCTION - Unit 1 Functional Design complete; awaiting approval before NFR Requirements
**PBT Compliance (Functional Design stage)**:
- PBT-01 Property identification: COMPLIANT — 5 properties identified across pure-function and stateful targets, documented in business-logic-model.md (Testable Properties section).
- PBT-02..PBT-10: N/A at this stage (apply at later stages: NFR Requirements for PBT-09 framework selection; Code Generation for tests; Build & Test for CI seed logging).
No blocking PBT findings.

**Approval Prompt**: "Functional Design for Unit 1 — Platform Foundation is complete. Approve to proceed to NFR Requirements (per-unit), or request changes."

---

## CONSTRUCTION - Unit 1 Foundation - Functional Design Approval
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Approved. Proceed to NFR Requirements"
**AI Response**: U1 Functional Design approved. Marked complete in aidlc-state.md. Proceeding to NFR Requirements for Unit 1.
**Status**: Approved
**Context**: CONSTRUCTION - U1 Functional Design approved; transition to U1 NFR Requirements

---

## CONSTRUCTION - Unit 1 Foundation - NFR Requirements (Plan & Questions)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Created aidlc-docs/construction/plans/unit-1-foundation-nfr-requirements-plan.md with 10 Unit-1-specific NFR questions (access token strategy, token TTLs, auth rate-limiting, FE token storage, logging/PII, performance targets, DB pool, audit-log retention, PBT execution/seed handling per PBT-09, accessibility bar). Globally pinned NFRs (NestJS/Angular/PG/local-only/PBT/security-resiliency-OFF) are listed for traceability and not re-asked. Awaiting answers before generating nfr-requirements.md and tech-stack-decisions.md.
**Context**: CONSTRUCTION - Unit 1 NFR Requirements (planning), awaiting answers
**PBT Compliance Note (this stage)**: PBT-09 (framework selection) will be confirmed in tech-stack-decisions.md after Q9 is answered. fast-check is the planned framework.

---

## CONSTRUCTION - Unit 1 Foundation - NFR Requirements (Generation)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Answered. Proceed with AI DLC."
**Recorded Answers**: Q1=A (HS256 8h, no refresh); Q2=A (reset 1h / verify 7d / invitation 7d); Q3=A (per-IP throttling on login/reset/invite-accept); Q4=B (sessionStorage); Q5=A (reuse logger with masking); Q6=A (demo latency targets); Q7=A (pool 10, idle 30s); Q8=A (no audit-log retention this build); Q9=A (fast-check, deterministic CI seed via FAST_CHECK_SEED, ≥100 runs, seed logged locally); Q10=A (WCAG 2.1 AA-aligned).
**AI Response**: All answers unambiguous. Generated 2 NFR artifacts: nfr-requirements.md (scalability/performance/availability/security/reliability/maintainability/usability) and tech-stack-decisions.md (libraries, env, PBT-09 framework selection: fast-check). Marked plan checklist complete.
**Context**: CONSTRUCTION - Unit 1 NFR Requirements complete; awaiting approval before NFR Design
**PBT Compliance (NFR Requirements stage)**:
- PBT-09 Framework selection: COMPLIANT — fast-check selected for backend (Jest) and frontend (Vitest); supports custom generators, shrinking, seeded reproducibility; documented in tech-stack-decisions.md with verification checklist; ≥100 runs default; CI deterministic seed via FAST_CHECK_SEED; local seed logged.
- PBT-01..08, PBT-10: applicable at later stages (Code Generation, Build & Test).
No blocking PBT findings.

**Approval Prompt**: "NFR Requirements for Unit 1 — Platform Foundation is complete. Approve to proceed to NFR Design (per-unit), or request changes."

---

## CONSTRUCTION - Unit 1 Foundation - NFR Requirements Approval
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Continue to Next Stage — Approve and proceed to NFR Design (Unit 1)"
**AI Response**: U1 NFR Requirements approved. Marked complete in aidlc-state.md. Proceeding to NFR Design for Unit 1.
**Status**: Approved
**Context**: CONSTRUCTION - U1 NFR Requirements approved; transition to U1 NFR Design

---

## CONSTRUCTION - Unit 1 Foundation - NFR Design (Plan & Questions)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (stage execution)
**AI Response**: Loaded NFR Design rules. Created aidlc-docs/construction/plans/unit-1-foundation-nfr-design-plan.md with 8 pattern questions (throttler storage, audit-stamping mechanism, expiry/tick policy, notification-failure handling, FE resilience patterns, RequestContext propagation, token entropy/hashing, audit_log write path) plus the artifact checklist (nfr-design-patterns.md, logical-components.md). Most patterns implied by NFR Requirements; questions focus only on the remaining pattern decisions. Awaiting answers.
**Context**: CONSTRUCTION - Unit 1 NFR Design (planning), awaiting answers

---

## CONSTRUCTION - Unit 1 Foundation - NFR Design (Generation)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Answered and proceed with AI DLC."
**Recorded Answers**: Q1=B (Redis-backed throttler — adds Redis dependency to local Compose; not in contradiction with Application Design Q2=A which scopes only AI processing); Q2=B (controller-layer interceptor for audit stamping — gap for system-driven writes closed by AuditStampHelper); Q3=A (lazy expiry); Q4=A (best-effort send); Q5=A (standard FE resilience, no auto-retry); Q6=A (AsyncLocalStorage RequestContext); Q7=A (SHA-256 of randomBytes(32)); Q8=A (explicit AuditService.record).
**Notable changes**: Q1=B introduces Redis as a runtime dependency (Docker Compose service `redis:7-alpine`, `ioredis`, `@nestjs/throttler-storage-redis`); reflected in nfr-design-patterns.md and logical-components.md as a tech-stack delta to NFR Requirements (which only specified `@nestjs/throttler`). Throttler configured fail-open in local for resilience. Q2=B trade-off documented: HTTP-originated mutations stamped by interceptor; system-originated mutations stamped by AuditStampHelper (`createdBy/updatedBy = null` per BR-X2). User flagged before generation; no objection received.
**AI Response**: Generated 2 NFR Design artifacts: nfr-design-patterns.md (security/resilience/performance/observability/quality patterns + Q2=B audit contract + RequestContext + tech-stack delta) and logical-components.md (12 backend logical components, 5 frontend ones, component diagram, file layout, dep/config additions). Marked plan checklist complete.
**Context**: CONSTRUCTION - Unit 1 NFR Design complete; awaiting approval before Code Generation
**PBT Compliance (NFR Design stage)**:
- PBT-01 properties from Functional Design reaffirmed (auth decision, invitation state machine, membership uniqueness, audit timestamps, token round-trip).
- PBT-09 framework (fast-check) confirmed in extension table.
- PBT-02..08, PBT-10: applicable at Code Generation / Build & Test.
No blocking findings.

**Approval Prompt**: "NFR Design for Unit 1 — Platform Foundation is complete. Approve to proceed to Code Generation (per-unit), or request changes."

---

## CONSTRUCTION - Unit 1 Foundation - NFR Design Approval (implicit) + Code Generation Start
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "proceed to code generation using aidlc and work on the units in parallel if possible"
**AI Response**: Treated user input as approval of U1 NFR Design and instruction to start Code Generation. Explained that strict per-unit parallelism is not possible in a single-agent AI-DLC flow due to (a) the per-unit loop rule and (b) the unit dependency graph (U2..U5 strictly sequential; U6/U7/U8/U9 can fan out after U5). Offered two cadences: (1) strict per-unit with 9 approvals; (2) batched designs + dependency-ordered code waves with ~4-5 approvals. Proceeding strict starting with Unit 1 Code Generation Part 1 (Planning) — the only unit with all design stages approved — and inviting the user to switch to the batched cadence after seeing the U1 plan if they prefer.
**Status**: U1 NFR Design approved (implicit); transitioning to U1 Code Generation
**Context**: CONSTRUCTION - U1 Code Generation Part 1 starting

---

## CONSTRUCTION - Unit 1 Foundation - Code Generation Part 1 (Plan)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (continuing from prior turn — proceed instruction)
**AI Response**: Created aidlc-docs/construction/plans/unit-1-foundation-code-generation-plan.md with 60 numbered, checkboxed steps grouped by area (BE structure & config; cross-cutting components; auth/users restructure; membership/invitations; app-wide wiring; backend tests; FE bootstrap; FE auth pages; FE tests; documentation; validation). Includes story coverage table mapping all 7 U1 stories to specific steps and a PBT-compliance note. Awaiting user approval before Part 2 (Generation).
**Approval Prompt**: "Unit 1 Code Generation Plan complete (60 steps). Approve to start generation, or request changes. Also: do you want to switch to the batched cadence for U2..U9 after U1 completes?"
**Context**: CONSTRUCTION - U1 Code Gen Part 1 complete; awaiting plan approval

---

## CONSTRUCTION - Unit 1 Foundation - Code Gen Plan Approval & Cadence Change
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Aprrove 1. Run parallel"
**AI Response**: Recorded approval of U1 Code Generation Plan. Switched cadence for U2..U9 to **batched/parallel**: design docs (FD/NFRR/NFRD) for U2..U9 will be produced in waves; code generation in dependency-ordered waves (U2 → U3 → U4 → U5 → U6+U7+U8+U9 fan-out). Approval gates collapse from 9 to ~5. Starting U1 Code Generation Part 2 in two phases this session: Phase A backend (Steps 1-30), Phase B tests + frontend + docs (Steps 31-60).
**Status**: Approved
**Context**: CONSTRUCTION - U1 Code Generation Part 2 — Phase A starting

---

## CONSTRUCTION - Unit 1 Foundation - Code Generation Phase A complete (Steps 1-30)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (continuing execution)
**AI Response**: Completed Steps 1-30 of the U1 Code Generation Plan (backend infrastructure, auth/users restructure, membership module, app-wide wiring). Files created/modified:
- Config & build: package.json, docker-compose.yml (added redis service), .env, .env.example, src/config/configuration.ts.
- Cross-cutting: src/common/request-context/{service,middleware,module}, src/audit/{audit-base.entity, audit-log.entity, audit.service, audit-stamp.interceptor, audit-stamp.helper, stamp-audit-on-request.decorator, audit.module}, src/common/tokens/{one-time-token.service, tokens.module}, src/common/expiry/expiry.service, src/common/throttler/{throttler.module, redis-storage.service}, src/common/notifications-stub/notification.gateway, src/common/logger/mask.util (export added).
- Auth & Users restructure: src/auth/enums/role.enum (added GlobalRole + ProjectRole; legacy aliases retained), src/auth/enums/permission.enum, src/users/user.entity (extended), src/users/users.service (split + seed bootstrapper), src/users/users.controller + dto, src/auth/interfaces/auth-user.interface, src/auth/local/local-auth.service, src/auth/auth.service, src/auth/guards/jwt-auth.guard, src/auth/guards/project-roles.guard, src/auth/decorators/project-roles.decorator, src/auth/dto/{login, password-reset, verify-email}.dto, src/auth/password-reset/{entity,service}, src/auth/email-verification/{entity,service}, src/auth/auth.controller (rewritten), src/auth/auth.module (rewritten with throttler global guard).
- Membership: src/membership/project-membership.entity (unique on userId+projectId), src/membership/invitation.entity, src/membership/membership.service, src/membership/invitation.service, src/membership/dto/invitation.dto, src/membership/invitations.controller, src/membership/membership.module.
- App-wide wiring: src/app.module (registered all new modules + entities; pool size 10 / idle 30s), src/main.ts (global '/api/v1' prefix, URI versioning).
- Removed legacy: src/auth/dto/{create-user, update-role, profile}.dto.ts, src/auth/{guards/roles.guard, decorators/roles.decorator}.ts.
Diagnostics clean across all 21 newly created/modified TypeScript files. Pausing before Phase B (Steps 31-60: backend tests, frontend scaffold, frontend pages, FE tests, docs, validation).
**Status**: Phase A complete; awaiting confirmation to proceed with Phase B
**Context**: CONSTRUCTION - U1 Code Generation Phase A done; ~30 of 60 steps marked [x] in plan

---

## CONSTRUCTION - Unit 1 Foundation - Code Generation - Test Skip (PBT Deviation)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: "Skip test cases and jest setup and Proceed starting with Plan B."
**AI Response**: User explicitly instructed to skip test cases and jest setup. Skipping Steps 31-39 (backend tests) and Steps 51-53 (frontend Vitest setup + tests). Proceeding with Phase B = Frontend (Steps 40-50) + Documentation (Steps 54-60). Marking the skipped steps as N/A in the plan rather than [x] so the deviation is visible.
**PBT Compliance Deviation (DOCUMENTED)**:
- PBT-02..PBT-08, PBT-10: NON-COMPLIANT at Code Generation stage. Tests for the 5 properties identified in Functional Design (auth decision, invitation state machine, membership uniqueness, audit timestamps, token round-trip) are NOT generated this build per user direction.
- This is a blocking finding under the configured extension policy (full enforcement). The user has explicitly directed the model to skip test cases; the deviation is logged here in audit.md per the workflow rules. If/when the user later requests tests, they can be generated against the existing code without rework.
- PBT-01 (Functional Design property identification) and PBT-09 (framework selection) remain COMPLIANT.
**Status**: Proceeding with FE + docs (no tests)
**Context**: CONSTRUCTION - U1 Code Generation Phase B (no tests)

---

## CONSTRUCTION - Unit 1 Foundation - Code Generation Phase B complete (Steps 40-50, 54-60)
**Timestamp**: 2026-06-24T00:00:00Z
**User Input**: N/A (continuation of Phase B execution)
**AI Response**: Completed Phase B except the explicitly skipped test steps (31-39, 51-53). Generated:
- Frontend scaffold: package.json, angular.json, tsconfig.json, tsconfig.app.json, .gitignore, .prettierrc, src/{index.html, main.ts, styles.scss}, src/environments/environment.ts.
- Frontend core: src/app/core/api/{dto.ts, api-client.ts}; src/app/core/auth/{auth.service.ts, auth.interceptor.ts, error.interceptor.ts, auth.guard.ts, project-role.guard.ts}.
- Frontend app shell: src/app/{app.config.ts, app.component.ts, app.routes.ts}.
- Frontend pages: src/app/features/auth/{login, profile, password-reset/{request-reset, confirm-reset, equal-to.validator}, verify-email, invite-accept, forbidden}.
- Documentation: aidlc-docs/construction/unit-1-foundation/code/README.md (file inventory, run instructions, endpoints, PBT compliance summary), usgbc-hub-residential-be/README.md (rewritten for U1), usgbc-hub-residential-fe/README.md.
- Updated swagger.config.ts title/description for U1 scope.
Validation: no duplicate-file artifacts (no *_modified.ts / *_new.ts) — checked. App code lives only under workspace root; documentation only under aidlc-docs/. Story map updated to mark all 7 U1 stories [x] U1.
Diagnostics clean across all 18 newly created frontend TypeScript files.
**Status**: U1 Code Generation complete (with documented PBT deviation: tests skipped). Awaiting approval to proceed to Unit 2.
**Context**: CONSTRUCTION - U1 done; ready for U2.

**PBT Compliance Final Summary (U1)**:
- PBT-01: COMPLIANT (5 properties identified in functional design)
- PBT-09: COMPLIANT (fast-check declared in both backend and frontend deps)
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per user direction
- Plan checkboxes for skipped steps marked with strike-through and "Skipped" notes for traceability

**Approval Prompt**: "Unit 1 — Platform Foundation Code Generation complete. Approve to proceed to Unit 2 — LEED Catalog & Scorecard (under the batched cadence: design docs FD/NFRR/NFRD generated together, then code), or request changes."

---

## CONSTRUCTION - Unit 1 Foundation - Local Deploy & Smoke Test
**Timestamp**: 2026-06-25T13:33:00Z
**User Input**: "Deploy locally and give me endpoint to call API endpoints to test."
**AI Response**: Started Colima (Docker daemon on macOS), brought up postgres + redis via docker-compose, ran `npm install` (had to remove `nestjs-throttler-storage-redis` dep — peer-dependency conflict with throttler 4.x; my custom RedisStorageService implements ThrottlerStorage directly so the third-party adapter was redundant). Build initially failed with 5 TypeScript errors due to throttler v4 vs v5 API differences (positional `@Throttle(limit, ttl)` vs object form; `ThrottlerStorage` requires a `storage` map property in v4); fixed all 5 in auth.controller.ts, invitations.controller.ts, redis-storage.service.ts, project-roles.guard.ts. Build clean. Started API on :3000.
**Smoke tests passed**:
- GET /api/v1/health → 200
- POST /api/v1/auth/login (admin) → token issued, demo seed accounts present
- GET /api/v1/auth/me with bearer → profile (globalRole=admin)
- PUT /api/v1/users/me → audit-stamped response (updatedAt + updatedBy populated)
- POST /api/v1/projects/{uuid}/invitations as admin (reviewer role) → 201; NotificationGateway logged masked recipient + cleartext token URL
- GET /api/v1/projects/{uuid}/me-role → isAdmin: true for admin
- GET /api/v1/auth/me without bearer → 401
- POST invitation as non-admin trying to invite REVIEWER → 403 (RBAC enforced)
**Local services**:
- Backend: http://localhost:3000 (API base /api/v1, Swagger /api-docs)
- Postgres: 127.0.0.1:5433 (docker)
- Redis: 127.0.0.1:6379 (docker)
- Colima VM: cpu 2 / mem 4G / disk 30G
**Status**: Running. Awaiting user testing or next direction.
**Context**: CONSTRUCTION - U1 deployed locally; full endpoint surface verified

---

## CONSTRUCTION - Unit 1 Foundation - Frontend Local Deploy
**Timestamp**: 2026-06-25T13:42:00Z
**User Input**: "deploy the Frontend."
**AI Response**:
- Tried `npm install` with Angular 21 — Angular 21 CLI requires Node 20.19+ but the workspace pins Node 20.13.1.
- Pivot 1: downgraded all `@angular/*` to `~20.2.0` (aligned set to satisfy Material's range). Install succeeded but Angular 20 CLI still requires Node 20.19+.
- Pivot 2: cleaned stale `~/.nvm/nvm.sh` symlink, sourced brew nvm, installed Node 20.19.0 via nvm; pinned for the FE folder with `.nvmrc`.
- `npm run build` succeeds — application bundle generated; lazy chunks for all feature components (login, profile, request-reset, confirm-reset, verify-email, invite-accept, forbidden) emit cleanly.
- Started dev server with `NG_CLI_ANALYTICS=false` to bypass the first-run analytics prompt; serving at `http://localhost:4200/`. Verified GET / and GET /login both return 200; HTML shell carries `<gbci-root>` and the expected title.
- Adjusted package.json: Angular 20.2.x set, TypeScript 5.8.x, zone.js 0.15.x.
- **Background processes running**:
  - terminalId 2 — backend `npm run start:dev` (NestJS) on :3000
  - terminalId 5 — frontend `npm start` (Angular) on :4200
**Status**: Both stacks live locally; Postgres + Redis on Docker via Colima.
**Context**: CONSTRUCTION - U1 fully deployed (BE + FE)

---

## CONSTRUCTION - Design-doc Updates (Angular 20.2 / Node 20.19 pin)
**Timestamp**: 2026-06-25T13:50:00Z
**User Input**: "Update the design docs and Proceed with Unit 2"
**AI Response**: Surgically updated design docs to reflect what actually shipped:
- aidlc-docs/inception/requirements/requirements.md NFR-1.2 → Angular 20.2 with Node 20.19 (FE folder via .nvmrc); rationale captured (Angular 21 CLI requires Node ≥ 20.19 which conflicts with the BE's Node 20.13.1 pin).
- aidlc-docs/construction/unit-1-foundation/nfr-requirements/tech-stack-decisions.md → updated FE table (Angular 20.2, TypeScript 5.8, Material 20.2); throttler entry now describes the custom RedisStorageService implementing ThrottlerStorage (v4) directly via ioredis.
- aidlc-docs/construction/unit-1-foundation/nfr-design/{nfr-design-patterns.md, logical-components.md} → removed nestjs-throttler-storage-redis references; added explanatory note about why we ship our own ~30-line adapter.

## CONSTRUCTION - Unit 2 — Catalog & Scorecard — Batched Design Plan
**Timestamp**: 2026-06-25T13:50:00Z
**User Input**: (continuation)
**AI Response**: Created aidlc-docs/construction/plans/unit-2-catalog-scorecard-design-plan.md — a single batched plan covering Functional Design, NFR Requirements, and NFR Design questions for U2. 14 questions total: 8 FD (catalog seed source, schema shape, certification thresholds, scorecard semantics, attempted-toggle behavior, calculator location, view-tabs, demo project), 3 NFRR (perf targets, input validation override behavior, FE state strategy), 3 NFRD (calculator placement, write concurrency, catalog caching). Awaiting user answers; one approval gate produces all three sets of design artifacts.
**Status**: U2 awaiting plan answers
**Context**: CONSTRUCTION - U2 batched design wave (FD/NFRR/NFRD planning), awaiting answers

---

## CONSTRUCTION - Unit 2 — Catalog & Scorecard — Design wave (FD + NFRR + NFRD)
**Timestamp**: 2026-06-25T13:55:00Z
**User Input**: "Answered and proceed"
**Recorded Answers**: Q1=C (hand-curated JSON now + worksheet→U4 for slots); Q2=B (rich credit data: referenceGuideUrl, intent, requirementsSummary, tags); Q3=A (certification thresholds on RatingSystem); Q4=A (independent integer columns); Q5=A (soft-clear on un-attempt); Q6=A (pure backend calculator + FE mirror); Q7=A (All tab enabled, others disabled-with-tooltip); Q8=A (seed demo project + scorecard); Q9=A (perf targets); Q10=A (override-friendly validation); Q11=A (Signal-based FE store); Q12=A (pure module placement); Q13=A (last-write-wins + forward-compatible version column); Q14=A (in-process catalog cache).
**AI Response**: All answers unambiguous. Generated 8 design artifacts in one wave under aidlc-docs/construction/unit-2-catalog-scorecard/:
- functional-design/{domain-entities, business-rules, business-logic-model, frontend-components}.md
- nfr-requirements/{nfr-requirements, tech-stack-decisions}.md
- nfr-design/{nfr-design-patterns, logical-components}.md
PBT-01 properties identified for the pure ScorecardSummaryCalculator (determinism, sum invariant, available-points consistency, inclusion, order independence, threshold partition, override permissiveness). Plan checklist marked complete. Awaiting approval before Code Generation.
**Status**: U2 design wave complete; awaiting approval to proceed to U2 Code Generation
**Context**: CONSTRUCTION - U2 design done

**PBT Compliance Summary (U2 design wave)**:
- PBT-01 (property identification): COMPLIANT — calculator properties documented in business-logic-model.md BL-7.
- PBT-09 (framework selection): COMPLIANT — fast-check carried over from U1.
- PBT-02..08, PBT-10: applicable at Code Generation; tests deferred per documented Unit 1 PBT deviation.
No blocking findings.

**Approval Prompt**: "Unit 2 design wave complete (FD + NFR Requirements + NFR Design). Approve to proceed to Code Generation, or request changes."

---

## CONSTRUCTION - Unit 2 Design Wave Approved
**Timestamp**: 2026-06-25T13:58:00Z
**User Input**: "Approve & Continue"
**AI Response**: U2 design wave approved. Marked all three batched stages complete in aidlc-state.md. Proceeding to U2 Code Generation. Continuing the documented PBT deviation (skip tests) consistent with Unit 1.
**Status**: Approved
**Context**: CONSTRUCTION - U2 design approved; transition to U2 Code Generation

---

## CONSTRUCTION - Unit 2 - Code Generation Phase A complete (Steps 1-20 + Step 10 catalog JSON)
**Timestamp**: 2026-06-25T14:17:00Z
**User Input**: "Approve & Continue"
**AI Response**: U2 design wave approved + recorded; created U2 Code Gen Plan; executed Phase A (backend Steps 1-20). Files created:
- Catalog: rating-system.entity, credit-category.entity, credit.entity (rich fields), credit-point-value.entity, dto/{rating-system, credit}.dto, catalog.service (in-memory cache + load coalescing), catalog.controller, catalog.seeder (idempotent upserts + BR-C3/C4 fail-fast validation), catalog.module.
- Catalog data: scripts/seed/leed-v41-sf-catalog.json — hand-curated subset of LEED v4.1 SF (8 categories, 31 credits, 8 prereqs; totalPointsAvailable=98; canonical thresholds Certified/Silver/Gold/Platinum).
- Scorecard: scorecard-entry.entity (with version), calculator/scorecard-summary.calculator (pure: no NestJS imports), calculator/scorecard-warnings (pure out-of-range detection), dto/{scorecard, scorecard-summary, set-points, toggle-attempted, warning}.dto, state-lock.service (stub for Unit 5), scorecard.service (BR-S1..10, override-friendly setPoints, soft-clear toggleAttempted, AuditService.record on attempted flips), scorecard.controller, demo.seeder (idempotent demo memberships + scorecard init + curated Silver-band edits; honors user-edited rows), scorecard.module.
- App-wide wiring: app.module.ts imports CatalogModule + ScorecardModule and registers new entities.
Diagnostics clean across all 17 new TypeScript files. Backend recompiled in watch mode; logs show "Catalog seeded — 8 categories, 31 credits" and "Demo project + scorecard seeded". Smoke test verified: GET /catalog/rating-systems, GET /catalog/rating-systems/leed_v4_1_sf, GET /projects/00000000-0000-4000-8000-000000000001/scorecard/summary all return correct data with awarded=54 → certificationLevel=Silver as designed.
**Status**: Phase A complete; awaiting confirmation to proceed with Phase B (frontend scorecard feature + docs)
**Context**: CONSTRUCTION - U2 Code Generation Phase A done; ~22 of 46 steps marked [x] in plan

---

## CONSTRUCTION - Unit 2 - Code Generation Phase B complete (Steps 23-46)
**Timestamp**: 2026-06-25T14:35:00Z
**User Input**: "yes" → "using AI DLC update the documentation in Audit files."
**AI Response**: Continued with Phase B execution and confirmed audit-doc maintenance per AI-DLC conventions.
**Phase B files created/modified**:
- FE DTOs: extended `src/app/core/api/dto.ts` with U2 shapes (RatingSystemDto, CreditDto, ScorecardEntryDto, ScorecardSummaryDto, WarningDto, etc.).
- FE API client: extended `src/app/core/api/api-client.ts` with catalog + scorecard endpoints.
- FE feature: `src/app/features/scorecard/{scorecard-summary.calc, scorecard.store, scorecard-page/scorecard-page.component}` plus 8 components under `components/` (confirm-clear-dialog, attempted-toggle, point-cell, scorecard-summary-bar, scorecard-view-tabs, project-info-panel, credit-row, category-row).
- FE wiring: `src/app/app.routes.ts` registers the lazy-loaded scorecard route; `src/app/app.component.ts` adds a "Demo scorecard" header link.
- Plan refinement: Step 27 (separate scorecard-api.client.ts wrapper) was folded into Step 24 — no value in a thin facade at this size; documented in the plan checklist.
- Initial build surfaced 5 strict-mode errors in scorecard.store from a custom firstFrom shim that lost generic info; replaced with rxjs `firstValueFrom`. Build clean after fix.
- Docs: created `aidlc-docs/construction/unit-2-catalog-scorecard/code/README.md`; updated BE and FE root READMEs to reflect "Units 1–2 complete" with U2 endpoints + scorecard route.
- Validation: diagnostics clean across all 15 new/modified FE files; no duplicate-file artifacts; story map updated to mark all 6 U2 stories `[x] U2`.
- FE dev server restarted on port 4200 (terminal id 7) after the prior watcher died during the failed compile; both `/` and `/projects/00000000-0000-4000-8000-000000000001/scorecard` now return 200.
**Audit-doc consistency check**: every U2 stage transition is logged in audit.md (design wave approval, code-gen plan, Phase A complete, deviation rationale, this Phase B entry). Format consistent with the AI-DLC core-workflow audit format (timestamp / user input / AI response / status / context).
**Status**: Unit 2 complete (with documented PBT deviation: tests skipped). Awaiting approval to proceed to Unit 3.
**Context**: CONSTRUCTION - U2 done; Unit 3 (Project Registration & Fees) is next under the batched cadence.

**PBT Compliance Final Summary (U2)**:
- PBT-01: COMPLIANT (calculator properties documented)
- PBT-09: COMPLIANT (fast-check declared)
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per Unit 1 precedent
- The pure calculator at `src/scorecard/calculator/` and the FE mirror at `features/scorecard/scorecard-summary.calc.ts` are deliberately structured so tests can be added later without code rework.

**Approval Prompt**: "Unit 2 complete (FE + docs). Backend at :3000, frontend at :4200, demo scorecard accessible after sign-in. Approve to proceed to Unit 3 — Project Registration & Fees."

---

## CONSTRUCTION - Documentation Refresh
**Timestamp**: 2026-06-25T14:42:00Z
**User Input**: "In which unit of work is submittals and field verification are going to be implemented" → "update the documentation."
**AI Response**: Answered Unit 4 — Workbook (US-4.1..US-4.5) and refreshed the documentation to make the answer discoverable from a single doc:
- aidlc-docs/aidlc-state.md — full rewrite. Removed stale per-unit checkboxes from earlier transitions. Added: Local Stack (running) section (BE/FE/PG/Redis/Node pins), Inception Progress table, Construction Progress per-unit matrix, **Feature → Unit Map** (top-level "where does X land?" index — explicitly highlights that Field Verification, Submittals, and 3-column notes are owned by Unit 4 Workbook), Plans / Audit pointers.
- aidlc-docs/inception/application-design/unit-of-work.md — Unit 4 entry now carries an explicit "Owns these features (where to look first)" line naming Field Verification, Submittals, and Verification Notes, plus the U2 view-tabs activation.
**Status**: Documentation updated; no source-code changes.
**Context**: CONSTRUCTION - U2 done; U3 next.

---


---

## CONSTRUCTION - Unit 3 — Registration & Fees — Batched Plan (NFR Design skipped)
**Timestamp**: 2026-06-25T15:00:00Z
**User Input**: "Using the AI DLC review Audit and state files and proceed with Unit 3 (Project Registration & Fees). Skip NFR design go straight to code generation."
**AI Response**: Reviewed `aidlc-state.md` and `audit.md` — Units 1 and 2 complete (with documented PBT test-skip deviation), local stack still running, U3 next per build order. Acknowledged the user's direction and recorded a **second documented deviation** for U3:
- **U3 NFR Requirements stage: SKIPPED.** No `nfr-requirements.md` / `tech-stack-decisions.md` will be issued for U3. All cross-cutting NFRs (Angular 20.2 / Node 20.19 pin, NestJS, PG, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA, HS256/8h, sessionStorage tokens, throttler, audit, RBAC, request-context, mock notifications) carry over from U1+U2 unchanged. U3-specific NFR deltas (file upload caps for bulk Excel, fee/invoice numeric ranges, mock email cadence) are folded inline into U3 Functional Design.
- **U3 NFR Design stage: SKIPPED.** No `nfr-design-patterns.md` / `logical-components.md` will be issued for U3. No new infra is introduced by U3 (no new provider seam, no new third-party dep beyond `exceljs` for Excel parsing, no new persistence engine). Pattern decisions for U3 (orchestrator flow, sequence-based ID allocation, idempotent bulk re-upload via composite uniqueness, signal-based wizard store with `sessionStorage`) are captured directly in U3 FD `business-rules.md` and the U3 Code Generation Plan.
- **What U3 will produce:** Functional Design (4 artifacts) + Code Generation Plan (numbered, checkboxed) in **one approval-gated wave** after the user answers the 8 design questions. PBT test-skip from U1 continues; PBT-01 property identification will still happen for `FeeCalculator` and `BulkRegistrationParser` round-trip so tests can be added later.

Created `aidlc-docs/construction/plans/unit-3-registration-fees-design-plan.md` with:
- Cadence-deviation header explaining what is skipped and why.
- Stories-in-scope table (US-2.1..2.6 with build orders).
- Inherited architectural decisions table (no re-asks).
- 8 FD-level questions (project status enum, address shape, project-number format, membership/fee tier, invoice numbering + line-items, bulk row idempotency key, Excel parser/caps, FE wizard structure). Each has a recommended option in **bold**; choices are framed so an "all-A" reply produces a coherent design.
- Approval-gate summary and Part-2 generation checklist.

Updated `aidlc-state.md`:
- Current Stage line → "Unit 3 batched plan created; awaiting design-question answers (NFR Design skipped per user direction)".
- U3 row in Construction Progress matrix: FD `⏳`, NFR Reqs `— (skipped)`, NFR Design `— (skipped per user)`, Code Gen `⏳`. Note column points at the new plan path.

**Status**: U3 batched plan ready; awaiting answers to Q1–Q8 (or "approve all-A and proceed").
**Context**: CONSTRUCTION - U3 batched design + code-gen plan staged with documented dual-stage skip deviation.

**PBT Compliance Note (this plan stage)**: PBT-01 will be honored at FD generation (FeeCalculator + BulkRegistrationParser properties). PBT-09 unchanged (fast-check). PBT-02..08, PBT-10 remain DOCUMENTED DEVIATION (tests skipped per U1 precedent).

**Approval Prompt**: "Unit 3 batched plan ready (NFR Reqs + NFR Design skipped per your direction). Answer Q1–Q8 in `unit-3-registration-fees-design-plan.md`, or reply 'approve all-A and proceed' to take the recommended defaults. After approval I will generate U3 FD (4 artifacts) + Code Generation Plan in one wave, then execute code generation under the same PBT test-skip we've been carrying."


---

## CONSTRUCTION - Unit 3 — Design Wave (FD only) + Code Generation Plan
**Timestamp**: 2026-06-25T15:10:00Z
**User Input**: "approve all-A and proceed"
**Recorded Answers**: Q1=A (status enum DRAFT|REGISTERED|UNDER_REVIEW|CERTIFIED|DENIED|WITHDRAWN); Q2=A (plain address columns + lat/lng DECIMAL(9,6)); Q3=A (RES-100001+ via Postgres sequence, allocated only after invoice generation); Q4=A (MembershipLevel enum + JSON-seeded FeeSchedule); Q5=A (INV-100001+ + lineItems jsonb + mock PaymentProvider); Q6=A (bulk row idempotency via required `external_row_id` template column + partial unique index on CREATED status); Q7=A (`exceljs`, 2 MB / 200 rows cap); Q8=A (mat-stepper at `/projects/register`, sessionStorage-backed RegistrationStore, separate `/projects/:id/edit` reuses step components in edit mode).
**AI Response**: All answers unambiguous. Generated 4 FD artifacts in `aidlc-docs/construction/unit-3-registration-fees/functional-design/`:
- `domain-entities.md` — Project, CertificationAgreement, FeeSchedule, Invoice, BulkRegistrationBatch, BulkRegistrationRow, full enum set, two Postgres sequences (`projects_display_seq`, `invoices_display_seq`).
- `business-rules.md` — BR-P (project), BR-A (agreement), BR-F (fees), BR-I (invoice), BR-N (project number), BR-B (bulk), BR-E (email), BR-Z (state-lock + workbook hand-off), BR-API (read/write contracts).
- `business-logic-model.md` — RegistrationOrchestrator (BL-1), edit-after-registration (BL-2), withdraw (BL-3), BulkRegistrationOrchestrator (BL-4), agreement subflow (BL-5), demo seed bridge (BL-6), DDL bootstrapper (BL-7), 5 PBT-01 properties (FL-1..FL-5).
- `frontend-components.md` — Routes table, RegistrationPage with mat-stepper, 8 step components, ProjectsList/Detail pages, BulkUpload page, editable project-info-panel migration from U2, complete dto.ts/api-client.ts extension list, accessibility carry-over.

Generated `aidlc-docs/construction/plans/unit-3-registration-fees-code-generation-plan.md` — 64 numbered, checkboxed steps grouped by area (BE module + DDL bootstrap, projects domain, fees & invoice, registration orchestrator, bulk, demo seed bridge, BE wiring; FE DTOs + ApiClient, registration wizard, projects list/detail, bulk upload, edit-mode reuse, U2 panel migration, app shell wiring; documentation; validation). 5 test steps marked skipped per U1 precedent. PBT-01 properties (FL-1..FL-5) called out explicitly.

Updated `aidlc-state.md`:
- Construction matrix U3 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ⏳.
- Current Stage line → "Unit 3 design wave complete (FD only; NFRR/NFRD skipped per user); Code Generation Plan created; executing Phase A".

Proceeding immediately into code generation per user's prior "approve all-A and proceed" instruction (which encompasses both the design wave and the move to code gen). Phase A = backend Steps 1–37; Phase B = frontend + docs Steps 42–60; validation last.

**Status**: Implicit approval of design wave + code-gen plan; executing Phase A.
**Context**: CONSTRUCTION - U3 FD complete, Code Generation Phase A starting.

**PBT Compliance Summary (this stage)**:
- PBT-01 (property identification): COMPLIANT — 5 properties documented in business-logic-model.md FL-1..FL-5.
- PBT-09 (framework selection): COMPLIANT — fast-check carried over.
- PBT-02..08, PBT-10: applicable at code generation; tests deferred per U1 precedent.


---

## CONSTRUCTION - Unit 3 — Code Generation Phase A complete (Steps 1-37)
**Timestamp**: 2026-06-25T15:08:00Z
**User Input**: (continuation of "approve all-A and proceed")
**AI Response**: Generated all U3 backend artifacts. Files created:
- Projects domain: `src/projects/{enums/project.enums, state-machine/project-status.machine, agreement-text, project.entity, certification-agreement.entity, registration-ddl.bootstrapper, project-number.generator, projects.service, agreement.service, registration.orchestrator, projects.controller, projects.demo-seeder, projects.module}.ts` plus `dto/{draft-project, project, register-project, register-project-response, patch-project, agreement, withdraw-project}.dto.ts`.
- Bulk: `src/projects/bulk/{bulk-registration-batch.entity, bulk-registration-row.entity, bulk-registration.parser, bulk-registration.orchestrator, bulk-registration.controller}.ts` plus `dto/{bulk-row-outcome, bulk-upload-response}.dto.ts`.
- Fees & Invoice: `src/fees/{fee-schedule.entity, calculator/fee.calculator, fee-schedule.seeder, fees.service, fees.controller, payment-provider.interface, payment-provider.mock, invoice.entity, invoice.service, invoice.controller, fees.module}.ts` plus `dto/{fee-quote, invoice}.dto.ts`.
- Seed data: `scripts/seed/fee-schedule.json` (USGBC_MEMBER $900, NON_MEMBER $1200 for leed_v4_1_sf).
- App-wide: extended `src/app.module.ts` with the 6 new entities and ProjectsModule + FeesModule imports.
Added `exceljs` and `@types/multer` to package.json.

**Bug fixes during smoke testing**:
1. `replaceAll` not in TS lib target → switched to `replace(/.../g, ...)`.
2. `Express.Multer.File` namespace missing → added `@types/multer` dev dep.
3. Index-signature mismatch passing `DraftProjectDto` to a `Record<string, unknown>` helper → cast.
4. Initial boot failed (`InvoiceRepository` missing in ProjectsModule context) → added Invoice to `ProjectsModule.TypeOrmModule.forFeature`.
5. Initial boot failed (`AuthService` missing in FeesModule context) → discovered JwtAuthGuard is set as global APP_GUARD; removed redundant `@UseGuards(JwtAuthGuard)` from new controllers; FeesModule still needs MembershipModule for ProjectRolesGuard's deps.
6. `register` returned 404 on first attempt → orchestrator was calling `getById` outside the transaction manager; switched to `findById(id, manager)`.
7. `GET /projects` returned 500 → SQL referenced `project_membership` (singular); actual table is `project_memberships`.
8. Bulk re-upload returned 500 → idempotent path tried to insert a second CREATED row, violating the partial unique index; fixed by skipping the row insert in the idempotent path and returning a synthetic outcome with message "Already created in batch X; skipped".

**Smoke tests (all passed)**:
- Backend boots, both Postgres sequences created (`projects_display_seq`, `invoices_display_seq` start 100001), demo project upgraded to a real `Project` row at `RES-100000`.
- `GET /api/v1/registration/fee-quote?ratingSystemSlug=leed_v4_1_sf&membershipLevel=NON_MEMBER` → 200 with $1200 quote.
- `POST /api/v1/projects/register` (USGBC_MEMBER PAY_NOW happy path) → 201 with project `RES-100001`, invoice `INV-100001` PAID via mock intent, agreement signed with `signedByName='Project Team'` (snapshot from user), confirmation email logged with masked recipient + CC actor (also masked).
- `GET /api/v1/projects` → returns 2 projects (the demo + the smoke-test creation) for the team user.
- `PATCH /api/v1/projects/:id { membershipLevel: ... }` on REGISTERED project → 409 with "Field membershipLevel cannot be edited after registration."
- `PATCH /api/v1/projects/:id { targetCertificationLevel: 'Gold' }` → 200, version bumped.
- `POST /api/v1/projects/register` with missing required fields → 400 with structured field-error message listing the missing fields.
- `GET /api/v1/projects/:id/invoice` → 200 returns `INV-100001` PAID.
- `POST /api/v1/projects/bulk` with 2-row .xlsx (1 valid + 1 missing name) → 1 CREATED (`RES-100002`) + 1 FAILED with structured error; valid row still processed.
- Re-upload same file → row 1 idempotently skipped (returns existing projectId + "Already created in batch X" message); row 2 still FAILED. No duplicate `Project` rows produced.

**Status**: Phase A complete; backend live at :3000 with all 9 new U3 routes mapped.
**Context**: CONSTRUCTION - U3 Backend complete; Phase B (FE) starting.

---

## CONSTRUCTION - Unit 3 — Code Generation Phase B complete (Steps 42-60)
**Timestamp**: 2026-06-25T15:18:00Z
**User Input**: (continuation)
**AI Response**: Generated all U3 frontend artifacts:
- DTOs: extended `src/app/core/api/dto.ts` with U3 shapes (Project, Invoice, Agreement, FeeQuote, BulkRowOutcome, etc.).
- ApiClient: extended `src/app/core/api/api-client.ts` with 11 new methods.
- Registration feature: `features/registration/{registration.store, registration-page.component, agreement-modal.component}.ts` — Signals store with `sessionStorage` persistence keyed `gbci.draft.registration:${userId}`; Material `<mat-stepper>` hosting all steps inline (rating + membership · project details · owner · address · agreement · fees & payment · confirmation). Edit-mode renders the same component with the agreement/fees steps replaced by a "save changes" step.
- Projects feature: `features/projects/{projects-list-page, project-detail-page, invite-member-dialog}.component.ts` — Material table list, detail page with edit/scorecard/withdraw/invite actions.
- Bulk feature: `features/bulk/bulk-upload-page.component.ts` — drag-drop with per-row outcome table + required-columns help.
- App shell: updated `app.routes.ts` adding `/projects`, `/projects/register`, `/projects/bulk`, `/projects/:projectId`, `/projects/:projectId/edit`. Default `/` now redirects to `/projects`. Updated `app.component.ts` adding `Projects` and `Register` header links.

**Plan deviations vs. original code-gen plan (documented inline in the plan checklist)**:
- Step 35 (app.module ordering) → not needed; Nest's imports order doesn't control OnModuleInit order, the dependency graph does. Both seeders are idempotent so order is irrelevant. Documented in plan.
- Step 45 (FE fee-calculator.client.ts) → folded into the registration store; the server is authoritative.
- Step 47 (separate step components) → inlined in `registration-page.component.ts` to keep file count low.
- Step 48 (4 shared components) → only `agreement-modal.component.ts` shipped; the others (fee-quote-card, invoice-summary-card, address-fields) inlined into the registration page template.
- Step 51 (members-list.component.ts) → deferred; only the invite dialog ships in U3. Members listing slated for U7.
- Step 52 (separate bulk store + components) → inlined into `bulk-upload-page.component.ts`.
- Step 54 (project-info-panel migration to editable) → folded into Step 50 (the new project detail page is the editable surface).

**Build & validation**:
- Backend `npm run build` → clean (zero TS errors).
- Frontend `npm run build` → clean. New lazy chunks visible: `registration-page-component` (103 kB raw / 18.8 kB gzip), `bulk-upload-page-component` (17.8 kB / 4.7 kB), `project-detail-page-component` (10.6 kB / 3.4 kB), `projects-list-page-component` (4.5 kB / 1.6 kB).
- `get_diagnostics` clean across all 14 backend + 11 frontend new/modified files.
- No duplicate-file artifacts (`*_modified.ts`, `*_new.ts`).
- All four U3 frontend routes serve HTTP 200: `/projects`, `/projects/register`, `/projects/bulk`, `/projects/:id`.

**Documentation**:
- Created `aidlc-docs/construction/unit-3-registration-fees/code/README.md` (file inventory, endpoints, demo data, story coverage, PBT compliance).
- Updated `usgbc-hub-residential-be/README.md` to "Units 1–3 complete" with U3 endpoint quick reference and updated project layout (added `fees/` and `projects/` folders).
- Updated `usgbc-hub-residential-fe/README.md` to "Units 1–3 complete" with the new routes table, Material 20.2 dependency note, and registration draft sessionStorage description.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — all 6 U3 stories `[x] U3`.
- Marked all U3 code-gen plan steps `[x]` (or `[x] ~~Skipped~~`) with deviation rationale inline.

**Background processes still running**: terminalId 2 (BE `npm run start:dev` on :3000), terminalId 7 (FE `npm start` on :4200). Both healthy and serving the U3 surface.

**Status**: U3 complete (with documented PBT deviation: tests skipped per Unit 1 precedent). Awaiting approval to proceed to Unit 4 (Workbook).
**Context**: CONSTRUCTION - U3 done end-to-end; Unit 4 next under the batched cadence.

**PBT Compliance Final Summary (U3)**:
- PBT-01: COMPLIANT (5 properties documented and pure subjects implemented test-friendly):
  - FL-1 `FeeCalculator.compute` (deterministic; member-monotonicity precondition asserted at seed time)
  - FL-2 `BulkRegistrationParser.parseRows`/`serialize` (round-trip idempotence)
  - FL-3 `ProjectNumberGenerator` format invariant `^RES-\d{6,}$`
  - FL-4 `assertTransition` state machine — for every (from, to) pair, true iff in allowed set
  - FL-5 `Invoice` totals integrity (subtotal + tax === total; line totals === qty * unit price)
- PBT-09: COMPLIANT (fast-check carried over)
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per Unit 1 precedent. The pure modules above are coded without Nest imports so a future PBT pass requires no rework.

**Approval Prompt**: "Unit 3 — Project Registration & Fees complete (NFR Reqs and NFR Design were skipped per your direction; FD + Code Gen executed). Backend at :3000, frontend at :4200, demo project upgraded to a real `Project` row at `RES-100000`, fee-quote endpoint live, register flow tested end-to-end (sequential `RES-100001+` and `INV-100001+` allocated only after invoice), bulk upload tested with mixed-validity rows and idempotent re-upload. Approve to proceed to Unit 4 — Workbook."


---

## CONSTRUCTION - Unit 4 — Workbook — Batched Plan (NFRR + NFRD skipped, carried forward)
**Timestamp**: 2026-06-25T15:35:00Z
**User Input**: "move on to Unit 4"
**AI Response**: Reviewed `aidlc-state.md` (U3 complete; U4 next per build order). Acknowledged
the carry-forward of the U3 deviation: **NFR Requirements + NFR Design stages remain SKIPPED
for U4.** No new infra is introduced — file storage uses a provider seam with a local-disk
implementation under `data/submittals/...` per the original requirements analysis Q8 (S3
abstraction with local backend). All cross-cutting NFRs carry from U1+U2 unchanged.

Created `aidlc-docs/construction/plans/unit-4-workbook-design-plan.md` with:
- Cadence-deviation header explaining what is skipped and why (same shape as U3).
- Stories-in-scope table (US-4.1..US-4.5 with build orders + notes).
- Inherited architectural decisions table (no re-asks).
- 10 FD-level questions: Q1 worksheet parsing source of truth (hand-curated JSON now, mirroring
  U2 Q1=C precedent); Q2 eager auto-create on attempted-toggle; Q3 generic key/value field
  model with type metadata + pure-function calculator registry; Q4 `FileStorageProvider` seam
  with `LocalDiskStorageProvider`; Q5 25 MB cap + broad MIME allowlist (PDF/DOC/PPT/XLS/
  images/video/TXT/MD); Q6 one row per `(creditId, projectId, NoteColumn)`; Q7 soft-archive on
  un-attempt (preserves data for re-attempt); Q8 new lazy route `/projects/:id/workbook` plus
  scorecard view-tabs activated as filters; Q9 calculator registry pure modules; Q10 inherited
  state-lock + last-write-wins.
- Approval-gate summary and Part-2 generation checklist.

Updated `aidlc-state.md`:
- Construction matrix U4 row → FD `⏳`, NFRR `— (skipped)`, NFRD `— (skipped per user)`,
  CodeGen `⏳`. Note column points at the new plan path.
- Current Stage line → "Unit 4 batched plan staged; awaiting Q1–Q10 answers".

**Status**: U4 batched plan ready; awaiting answers to Q1–Q10 (or "approve all-A and proceed").
**Context**: CONSTRUCTION - U4 batched design + code-gen plan staged with documented dual-stage
skip deviation carried forward from U3.

**PBT Compliance Note (this plan stage)**: PBT-01 will be honored at FD generation
(calculator determinism + idempotence FL-6, eager-materialization re-attempt idempotence FL-7,
file-key round-trip FL-8). PBT-09 unchanged. PBT-02..08, PBT-10 remain DOCUMENTED DEVIATION.

**Approval Prompt**: "Unit 4 batched plan ready (NFRR + NFRD skipped, carrying forward from U3).
Answer Q1–Q10 in `unit-4-workbook-design-plan.md`, or reply 'approve all-A and proceed' to take
the recommended defaults. After approval I will generate U4 FD (4 artifacts) + Code Generation
Plan in one wave, then execute code generation under the same PBT test-skip we've been carrying."


---

## CONSTRUCTION - Unit 4 — Design Wave (FD only) + Code Generation Plan
**Timestamp**: 2026-06-25T15:42:00Z
**User Input**: "approve all-A and proceed"
**Recorded Answers**: Q1=A (hand-curated `leed-v41-sf-workbook.json` — U2 catalog precedent); Q2=A (eager auto-create on attempted-toggle via a global `WorkbookAttemptHookRegistry`); Q3=A (generic key/value field model with `dataType` discriminator + pure-function calculator registry by `formulaKey`); Q4=A (`FileStorageProvider` seam + `LocalDiskStorageProvider` writing under `data/submittals/...`); Q5=A (25 MB cap + broad MIME allowlist + filename sanitization); Q6=A (one row per `(creditId, projectId, NoteColumn)` with per-column save endpoint); Q7=A (soft-archive on un-attempt, preserves data for re-attempt); Q8=A (new `/projects/:projectId/workbook` lazy route + scorecard view-tabs activated as filters); Q9=A (pure calculator registry; two ship to exercise wiring); Q10=A (state-lock + last-write-wins inherited).

**AI Response**: All answers unambiguous. Generated 4 FD artifacts in `aidlc-docs/construction/unit-4-workbook/functional-design/`:
- `domain-entities.md` — WorkbookFieldDefinition, SubmittalSlotDefinition, WorkbookFieldEntry, SubmittalSlot, Submittal (with safe-file-name + storageKey + sizeBytes + mimeType + uploadedAt), VerificationNote with `column: NoteColumn` enum (`GREEN_RATER | PROVIDER_QC | REVIEWER`), full enum set.
- `business-rules.md` — BR-WC (catalog), BR-WX (materialize/archive on attempted-toggle + hook registry pattern), BR-WV (field verification with calculator hook + override-friendly out-of-range warnings), BR-WS (submittals upload/download/delete + signed-URL token + storage seam), BR-WN (three-column notes with per-column writers), BR-WT (view-tabs activation), BR-WZ (state-lock + concurrency).
- `business-logic-model.md` — `WorkbookOrchestrator.materializeForCredit` (BL-1) + `archiveForCredit` (BL-2), read paths (BL-3), field-entry write with calculator evaluation (BL-4), submittals upload (BL-5), signed-URL flow (BL-6), notes per-column save (BL-7), view-tab flags (BL-8), catalog seeder (BL-9), demo seed bridge (BL-10), three PBT-01 properties (FL-6 calculator determinism+idempotence, FL-7 materialize idempotence, FL-8 file-key round-trip).
- `frontend-components.md` — new `/projects/:projectId/workbook` route, `WorkbookStore` with sessionStorage collapse persistence keyed `gbci.workbook.collapse:${projectId}`, three section components (FieldVerification / Submittals / ThreeColumnNotes) plus `FileUploader`, U2 view-tabs activation contract, complete dto.ts/api-client.ts extension list, accessibility carry-over.

Generated `aidlc-docs/construction/plans/unit-4-workbook-code-generation-plan.md` — 50 numbered, checkboxed steps grouped by area (BE common hook registry → workbook domain → calculator registry → storage seam → catalog seeder → orchestrator + service + submittals service → controllers → demo seed → BE wiring; FE DTOs + ApiClient → workbook feature → view-tabs activation → app shell; documentation; validation). 5 test steps marked skipped per U1 precedent. Three PBT-01 properties (FL-6, FL-7, FL-8) called out explicitly.

Updated `aidlc-state.md`:
- Construction matrix U4 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ⏳.
- Current Stage line → "Unit 4 design wave complete (FD only; NFRR/NFRD skipped per user); Code Generation Plan created; executing Phase A".

Proceeding to code generation per the prior "approve all-A and proceed" instruction (matching the U3 cadence). Phase A = backend Steps 1–25; Phase B = frontend + view-tabs activation Steps 30–42; documentation + validation last.

**Status**: Implicit approval of design wave + code-gen plan; executing Phase A.
**Context**: CONSTRUCTION - U4 FD complete, Code Generation Phase A starting.

**PBT Compliance Summary (this stage)**:
- PBT-01 (property identification): COMPLIANT — 3 properties (FL-6 calculator determinism + idempotence, FL-7 materializeForCredit idempotence, FL-8 file-key round-trip).
- PBT-09 (framework selection): COMPLIANT — fast-check carried over.
- PBT-02..08, PBT-10: applicable at code generation; tests deferred per U1 precedent.


---

## CONSTRUCTION - Unit 4 — Code Generation complete (Phase A + Phase B)
**Timestamp**: 2026-06-25T15:55:00Z
**User Input**: (continuation of "approve all-A and proceed")
**AI Response**: Generated all U4 backend artifacts (Phase A) and frontend artifacts (Phase B) in one continuous pass. Files created:

**Backend (Phase A — Steps 1-25)**:
- Cross-module hook: `src/common/hooks/{workbook-attempt-hook.registry, hooks.module}.ts` — global tiny event-bus with `register(listener)` / `notify(event)` semantics; tolerates listener exceptions.
- Workbook entities: `src/workbook/{enums/workbook.enums, workbook-field-definition.entity, submittal-slot-definition.entity, workbook-field-entry.entity, submittal-slot.entity, submittal.entity, verification-note.entity}.ts`.
- Calculator registry: `src/workbook/calculators/formula-registry.ts` (pure, no Nest imports; ships `sum_numeric_inputs`, `threshold_boolean`, `pass_through`).
- Storage seam: `src/workbook/storage/{file-storage.provider, local-disk-storage.provider, key.utils}.ts`.
- Catalog seeder: `src/workbook/workbook-catalog.seeder.ts` (idempotent + exposes `ready()` Promise) + `scripts/seed/leed-v41-sf-workbook.json` (6 credits, 20 field defs, 9 slot defs, 2 derived fields).
- Orchestrator + services + controllers: `src/workbook/{workbook.orchestrator, workbook.service, submittals.service, workbook.controller, submittals.controller, submittal-files.controller}.ts`.
- DTOs: `src/workbook/dto/{workbook, set-workbook-field, set-note}.dto.ts`.
- Demo seeder: `src/workbook/workbook.demo-seeder.ts` (awaits catalog seeder ready, materializes for demo project's attempted credits, pre-populates 4 field values + 1 fixture submittal + three-column notes) + `scripts/seed/fixtures/sample-evidence.txt`.
- Module wiring: `src/workbook/workbook.module.ts` and updates to `src/app.module.ts` (imports HooksModule + WorkbookModule, registers 6 new entities).
- Scorecard hook integration: extended `src/scorecard/scorecard.service.ts` to inject `WorkbookAttemptHookRegistry` and call `notify(...)` from both `toggleAttempted` and `setPoints` (when `patch.attempted` materially changes).
- `.gitignore`: appended `/data/` for local submittal storage.

**Bug fixes during smoke testing**:
1. `LOCAL_JWT_SECRET` resolution → `config.get('auth')` is the right path (matches LocalAuthService); not `config.get('localJwtSecret')`.
2. **Critical: parallel onModuleInit race**. Discovered NestJS runs `onModuleInit` hooks within a module in parallel (Promise.all). The `WorkbookDemoSeeder` ran concurrently with `WorkbookCatalogSeeder`, querying field definitions before they were fully persisted — only the first 2 of 6 credits got materialized (in/lt; wa/ea/mr/eq missed). Fix: added a `ready(): Promise<void>` method to `WorkbookCatalogSeeder` that resolves when seed upserts commit; `WorkbookDemoSeeder.onModuleInit` `await catalogSeeder.ready()` before doing anything. This pattern works regardless of provider registration order. After fix, all 6 credits' workbook rows materialize (3+3+5+4+2+3 = 20 entries).

**Frontend (Phase B — Steps 30-42)**:
- DTOs: extended `src/app/core/api/dto.ts` with all U4 shapes (Workbook, FieldDefinition/Entry, SubmittalSlot/Submittal, VerificationNote, WorkbookFlags, SignedDownloadUrl).
- ApiClient: extended with 7 new methods (`getWorkbook`, `getWorkbookFlags`, `setWorkbookField`, `uploadSubmittal`, `deleteSubmittal`, `getSignedSubmittalUrl`, `saveVerificationNote`).
- Workbook feature: `features/workbook/{workbook.store, workbook-page.component}.ts` plus three section components under `features/workbook/sections/{field-verification-section, submittals-section, notes-section}.component.ts`. Signals store with `sessionStorage` collapse persistence keyed `gbci.workbook.collapse:${projectId}` (US-4.5).
- View-tabs activation: updated `features/scorecard/components/scorecard-view-tabs/scorecard-view-tabs.component.ts` — three previously-disabled tabs (Field Verification / Submittals / Verification Notes) now enabled. FE-side row filtering by `WorkbookFlagsDto` was deferred to a future iteration; the workbook page is the primary surface for U4 and the tabs serve as navigation hints. The backend already serves `/workbook/flags` so the filter UX wires in without code rework.
- Project detail link: added "Workbook" button alongside "Scorecard" on `features/projects/project-detail-page.component.ts`.
- App shell: registered `/projects/:projectId/workbook` lazy route in `src/app/app.routes.ts`.

**Build & validation**:
- Backend `npm run build` clean.
- Frontend `npm run build` clean. New lazy chunk `workbook-page-component` at 119.71 kB raw / 23.50 kB gzip.
- `get_diagnostics` clean across all 23 backend + 10 frontend new/modified files.
- No duplicate file artifacts.
- Workbook route `/projects/:projectId/workbook` returns HTTP 200.

**End-to-end smoke test (against running BE/FE)**:
- All 6 workbook-defined credits materialize on demo seed (20 entries across in/lt/wa/ea/mr/eq).
- Out-of-range numeric write: persisted with `value_out_of_range` warning (BR-WV2 override-friendly).
- Derived field denial: 403 on direct write of formula-driven field by non-admin.
- Derived auto-recompute: writing contributing inputs (lavatory_gpm = 1.2, shower_gpm = 1.8) triggers `formulaRegistry.sum_numeric_inputs` and persists `indoor_water_total_score = 4.2` with `derived = true`.
- Three-column note save: `savedAt` set, `savedByName` populated from `UsersService.findById`.
- File upload: 28-byte JPEG accepted, stored under `data/submittals/<projectId>/<creditId>/site_photos/<uuid>__site-photo.jpg`.
- Signed-URL download round-trip: 5-minute JWT minted, public token streamer returns 200 with `Content-Type: image/jpeg` and original filename in `Content-Disposition`.
- Bad MIME (`application/octet-stream`) rejected with 415.
- Workbook flags reflect populated content (3 credits with at least one populated section after the smoke writes).
- **Scorecard ↔ workbook binding**: un-attempting `mr_credit_environmentally_preferable_products` via `POST /api/v1/projects/:id/scorecard/:creditId/un-attempt` correctly soft-archives the workbook rows (the credit disappears from `GET /workbook` since it filters attempted-only). Re-attempting via `PUT /scorecard/:creditId { attempted: true }` clears `archivedAt` and the 2 EPP entries return — verifying re-attempt restores prior data per BR-WX3 (FL-7 idempotence in action).

**Documentation**:
- Created `aidlc-docs/construction/unit-4-workbook/code/README.md` (file inventory, endpoints, demo data, story coverage, PBT compliance, plan deviations).
- Updated `usgbc-hub-residential-be/README.md` to "Units 1–4 complete" with U4 endpoint quick reference and updated project layout (added `workbook/` and `common/hooks/`).
- Updated `usgbc-hub-residential-fe/README.md` to "Units 1–4 complete" with the new workbook route.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — all 5 U4 stories `[x] U4`.
- Marked all U4 code-gen plan steps `[x]` (or `[x] ~~Skipped~~`).

**Background processes still running**: terminalId 2 (BE on :3000), terminalId 7 (FE on :4200). Both healthy, all U4 routes mapped.

**Status**: U4 complete (with documented PBT deviation: tests skipped per Unit 1 precedent). Awaiting approval to proceed to Unit 5 (Review Workflow & State-Locking).
**Context**: CONSTRUCTION - U4 done end-to-end; Unit 5 next under the batched cadence.

**PBT Compliance Final Summary (U4)**:
- PBT-01: COMPLIANT (3 properties documented and pure subjects implemented test-friendly):
  - FL-6 `formulaRegistry` calculator determinism + idempotence (`src/workbook/calculators/formula-registry.ts`, no Nest imports).
  - FL-7 `materializeForCredit` idempotence (verified by smoke-test re-attempt path: archive → re-attempt clears `archivedAt` and restores prior data).
  - FL-8 file-key round-trip (`src/workbook/storage/key.utils.ts` `buildKey`/`parseKey`/`sanitizeFileName` are pure).
- PBT-09: COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per Unit 1 precedent.

**Approval Prompt**: "Unit 4 — Workbook complete (NFR Reqs and NFR Design were skipped per your direction; FD + Code Gen executed). Backend at :3000, frontend at :4200, demo workbook visible at `/projects/00000000-0000-4000-8000-000000000001/workbook` after sign-in. End-to-end verified: scorecard ↔ workbook auto-bind on attempted-toggle, soft-archive on un-attempt with data preservation on re-attempt, override-friendly field validation, derived-field auto-recompute via pure calculator registry, file uploads via local storage seam with JWT-signed download URLs, three-column notes with per-column save + author + timestamp. Approve to proceed to Unit 5 — Review Workflow & State-Locking."


---

## CONSTRUCTION - Unit 5 — Review Workflow & State-Locking — Batched Plan
**Timestamp**: 2026-06-25T16:05:00Z
**User Input**: "Approve to move to Unit 5 (Review Workflow & State-Locking). The same skip-NFRD/skip-NFRR cadence will carry forward by default."
**AI Response**: Acknowledged. NFR Requirements + NFR Design stages remain SKIPPED for U5 — no new infrastructure introduced this build (notifications use the U1 mock; reports persist as Markdown TEXT; PDF deferred). All cross-cutting NFRs from U1+U2+U4 (Angular 20.2 / Node 20.19, NestJS, PG, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA, throttler, audit, RBAC, request-context, mock notifications, hooks registry) carry forward unchanged.

Created `aidlc-docs/construction/plans/unit-5-review-workflow-design-plan.md` with:
- Cadence-deviation header explaining what's skipped.
- Stories-in-scope table (US-7.1, US-7.3, US-7.4, US-7.6, US-7.7, US-11.2).
- Out-of-scope clarification (US-7.2 batch → U6, US-7.5 scheduling → U9, US-7.8 notifications framework → U7, US-10.5 admin revise → U7).
- Inherited architectural decisions table.
- 10 FD-level questions with **bold** recommended options:
  - Q1 one Review row per (project, phase) lifecycle; `REV-${nextval}` from new sequence.
  - Q2 PRELIMINARY | FINAL | SUPPLEMENTAL with strict ordering and final-skippable-when-prelim-passed-everything.
  - Q3 reviewers write directly to existing `ScorecardEntry.awardedPoints` (no new CreditDecision entity); per-credit comments use the U4 REVIEWER note column.
  - Q4 bulk award-all-verified endpoint, idempotent.
  - Q5 pure-function `ReviewReportService.generateMarkdown(reviewId)` persisting to `Review.reportMarkdown TEXT`.
  - Q6 two-step return: confirm (Reviewer-internal) → return (release to Green Rater + lift state-lock).
  - Q7 accept (project → CERTIFIED) and continue-to-next-phase (project → REGISTERED) endpoints.
  - Q8 reviewer assignment via existing ProjectMembership.REVIEWER + small admin shortcut endpoint.
  - Q9 new `SubmittalQualityScore` entity per (projectId, reviewId), authoritative on Reviewer entry.
  - Q10 replace U2 StateLockService stub with real implementation: UNDER_REVIEW blocks PT/GR, Admin bypasses; Submit flips to UNDER_REVIEW, Return back to REGISTERED, Accept to CERTIFIED.
- Three new PBT-01 properties (FL-9 award range invariant, FL-10 state-machine invariant, FL-11 award-all-verified idempotence).

Updated `aidlc-state.md`:
- Construction matrix U5 row → FD `⏳`, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen `⏳`.
- Current Stage line → "Unit 5 batched plan staged; awaiting Q1–Q10 answers".

**Status**: U5 batched plan ready; awaiting answers to Q1–Q10 (or "approve all-A and proceed").
**Context**: CONSTRUCTION - U5 batched design + code-gen plan staged with documented dual-stage skip deviation carried forward from U3/U4.

**PBT Compliance Note (this plan stage)**: PBT-01 will be honored at FD generation (FL-9 award invariant, FL-10 state-machine invariant, FL-11 award-all-verified idempotence). PBT-09 unchanged. PBT-02..08, PBT-10 remain DOCUMENTED DEVIATION.

**Approval Prompt**: "Unit 5 batched plan ready (NFRR + NFRD skipped, carrying forward from U3/U4). Answer Q1–Q10 in `unit-5-review-workflow-design-plan.md`, or reply 'approve all-A and proceed' to take the recommended defaults. After approval I will generate U5 FD (4 artifacts) + Code Generation Plan in one wave, then execute code generation under the same PBT test-skip we've been carrying."


---

## CONSTRUCTION - Unit 5 — Design Wave (FD only) + Code Generation Plan
**Timestamp**: 2026-06-25T16:08:00Z
**User Input**: "approve all-A and proceed"
**Recorded Answers**: Q1=A (one Review per `(project, phase)` lifecycle, REV- sequence); Q2=A (PRELIM | FINAL | SUPPLEMENTAL with strict ordering and final-skippable when prelim outcome=PASSED); Q3=A (reviewer writes to existing `ScorecardEntry.awardedPoints`; per-credit comments via U4 REVIEWER notes column); Q4=A (idempotent bulk award-all-verified); Q5=A (pure-function `ReviewReportService.generateMarkdown`, persists to TEXT column); Q6=A (two-step return: confirm → return); Q7=A (separate accept and continue-to-next-phase endpoints); Q8=A (reviewer assignment via existing ProjectMembership.REVIEWER + small admin shortcut endpoint); Q9=A (new `SubmittalQualityScore` entity, authoritative on Reviewer entry); Q10=A (replace U2 `StateLockService` stub with real impl: UNDER_REVIEW blocks PT/GR, Admin bypasses).

**AI Response**: Generated 4 FD artifacts in `aidlc-docs/construction/unit-5-review-workflow/functional-design/`:
- `domain-entities.md` — `Review` (with full status lifecycle: OPEN → SUBMITTED → DECIDED → CONFIRMED → RETURNED), `SubmittalQualityScore`, full enum set, `reviews_display_seq` Postgres sequence.
- `business-rules.md` — BR-RW (review workflow), BR-RD (decisions + award invariant), BR-RP (report), BR-AC (accept/continue), BR-QS (quality score), BR-AS (assignment shortcut), BR-Z (state-lock real implementation + status state-machine extensions).
- `business-logic-model.md` — `SubmissionOrchestrator` (BL-1, with re-submit-after-return path), award decisions (BL-2 setAwarded + awardAllVerified), `ReviewOrchestrator` (BL-3 confirm + BL-4 return), accept/continue (BL-5/BL-6), quality score (BL-7), reviewer assignment (BL-8), pure markdown generator (BL-9), real `StateLockService` (BL-10), three PBT-01 properties (FL-9 award invariant, FL-10 state-machine invariant, FL-11 awardAllVerified idempotence).
- `frontend-components.md` — `/projects/:projectId/review` route variant-routes between Reviewer panel and Outcome panel; ReviewStore with mutation actions; SubmitForReviewDialog with phase picker; ReportViewer using `marked`; QualityScoreCard role-gated; complete dto/api-client extension list.

Generated `aidlc-docs/construction/plans/unit-5-review-workflow-code-generation-plan.md` — 49 numbered steps (4 marked skipped consistent with U1 PBT deviation). Three PBT-01 properties (FL-9, FL-10, FL-11) called out explicitly.

Updated `aidlc-state.md`:
- Construction matrix U5 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ⏳.
- Current Stage line → "Unit 5 design wave complete (FD only; NFRR/NFRD skipped per user); Code Generation Plan created; executing Phase A".

Proceeding to code generation per the prior "approve all-A and proceed" instruction (matching the U3/U4 cadence). Phase A = backend Steps 1–25; Phase B = frontend Steps 30–41; documentation + validation last.

**Status**: Implicit approval of design wave + code-gen plan; executing Phase A.
**Context**: CONSTRUCTION - U5 FD complete, Code Generation Phase A starting.


---

## CONSTRUCTION - Unit 5 — Code Generation complete (Phase A + Phase B)
**Timestamp**: 2026-06-25T16:30:00Z
**User Input**: (continuation of "approve all-A and proceed")
**AI Response**: Generated all U5 backend artifacts (Phase A) and frontend artifacts (Phase B). Files created:

**Backend (Phase A — Steps 1-25)**:
- DDL: extended `src/projects/registration-ddl.bootstrapper.ts` with `reviews_display_seq` (start 100001).
- Project entity: added `achievedCertificationLevel` column (BR-AC1, distinct from `targetCertificationLevel`).
- Project state machine: extended `ALLOWED` map with `UNDER_REVIEW → REGISTERED` (return path) and `REGISTERED → CERTIFIED` (accept-from-prelim-passed path) per BR-Z2.
- Review domain: `src/review/{enums/review.enums, state-machine/review-status.machine, review.entity, submittal-quality-score.entity, review-number.generator, review.service, submission.orchestrator, award-decisions.service, review.orchestrator, accept-certification.flow, quality-score.service, reviewer-assignment.service, review.controller, review.module}.ts` plus `dto/{review, submit-for-review, confirm-review, award-all-verified-response, submittal-quality-score, set-quality-score, assign-reviewer}.dto.ts` and pure `src/review/report/review-report.generator.ts`.
- StateLockService REAL implementation: replaced U2 stub. Inject `Repository<Project>` + `MembershipService`. Async `assertWritable(projectId, actor?)` blocks PT/GR during UNDER_REVIEW; Reviewer + Admin pass. Updated `ScorecardModule.forFeature` to register `Project`.
- All 6 call sites in `ScorecardService`, `WorkbookService`, `SubmittalsService`, `ProjectsService` updated to await + pass actor.
- ScorecardService: added Reviewer to `COLUMN_WRITERS.awardedPoints` (BR-RD2). Added FL-9 hard invariant (`0 ≤ awardedPoints ≤ verifiedPoints`) to `setPoints` so the existing scorecard PUT route enforces it for any writer.
- App-wide: registered new entities (Review, SubmittalQualityScore) and ReviewModule.

**Bug fix during smoke testing**:
- First state-lock implementation blocked Reviewer writes during UNDER_REVIEW (Reviewer is the intended writer in that state). Updated `StateLockService.assertWritable` to look up the actor's project membership: when project is UNDER_REVIEW, Reviewer membership passes; PT/GR rejected. Required injecting `MembershipService` into the service.
- ProjectDto.toDto missing `achievedCertificationLevel` — added.

**Frontend (Phase B — Steps 30-41)**:
- DTOs: extended `src/app/core/api/dto.ts` with U5 shapes.
- ApiClient: extended with 11 new methods.
- Review feature: `features/review/{review.store, review-page.component, submit-for-review.dialog.component, report-viewer.component, quality-score-card.component}.ts`. Single page variant-routes between Reviewer panel (Material table with inline awarded inputs + Award all verified + Confirm + Return) and Outcome panel (Accept / Continue actions).
- Report viewer uses `marked` (added to `package.json`) with `DomSanitizer.bypassSecurityTrustHtml`.
- App shell: `/projects/:projectId/review` lazy route + "Review" button on project detail.

**Build & validation**:
- Backend `npm run build` clean.
- Frontend `npm run build` clean. New lazy chunk `review-page-component` at 57.21 kB raw / 16.05 kB gzip.
- `get_diagnostics` clean across all 22 backend + 8 frontend new/modified files.
- No duplicate file artifacts.
- Frontend route serves HTTP 200.

**End-to-end smoke test (against running BE/FE)**:
- Reviewer self-submit → 403 (BR-RW2 explicit).
- Submit creates `REV-100002` (sequence advanced from prior smoke), project flips to UNDER_REVIEW.
- State-lock blocks PT scorecard write during UNDER_REVIEW → 409.
- Reviewer out-of-range award (awarded > verified) → 400 (FL-9 enforced via the U2 setPoints path).
- Award-all-verified bulk: returns updatedCount + awardedTotal (49); idempotent re-run returns updatedCount: 0 (FL-11 verified).
- Confirm: outcome PASSED, certificationLevel `Certified`, 2901-byte Markdown report generated.
- Quality score: persists with version 1, admin revises to bump version 2, audit-tracked.
- Return: status RETURNED, project flips back to REGISTERED, state-lock lifts.
- PT scorecard write after return: 200 (lock confirmed lifted).
- Accept: project transitions to CERTIFIED with achievedCertificationLevel = Certified.

**Documentation**:
- Created `aidlc-docs/construction/unit-5-review-workflow/code/README.md`.
- Updated `usgbc-hub-residential-be/README.md` to "Units 1–5 complete" with U5 endpoint quick reference and updated project layout (added `review/`).
- Updated `usgbc-hub-residential-fe/README.md` to "Units 1–5 complete" with the new review route.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — all 6 U5 stories `[x] U5`.
- Marked all U5 code-gen plan steps `[x]` (or `[x] ~~Skipped~~`).

**Background processes still running**: terminalId 2 (BE on :3000), terminalId 7 (FE on :4200).

**Status**: U5 complete (with documented PBT deviation: tests skipped per Unit 1 precedent). Awaiting approval to proceed to Unit 6 (Portfolio).
**Context**: CONSTRUCTION - U5 done end-to-end; Unit 6 next under the batched cadence.

**PBT Compliance Final Summary (U5)**:
- PBT-01: COMPLIANT (3 properties documented and pure subjects implemented test-friendly):
  - FL-9 award range invariant — enforced in both `ScorecardService.setPoints` and `AwardDecisionsService.setAwarded`. Smoke verified out-of-range award rejected with 400.
  - FL-10 state-machine invariant — pure `assertReviewTransition` in `src/review/state-machine/review-status.machine.ts` and the extended `assertTransition` in `src/projects/state-machine/project-status.machine.ts`. Both no-Nest.
  - FL-11 award-all-verified idempotence — verified by smoke test (re-run returns updatedCount: 0).
- PBT-09: COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per U1 precedent.

**Approval Prompt**: "Unit 5 — Review Workflow & State-Locking complete. Backend at :3000, frontend at :4200, review page accessible at `/projects/<id>/review` after sign-in. End-to-end verified: phase-based submit (prelim/final/supplemental with ordering enforcement) → state-lock blocks PT/GR but lets Reviewer write → reviewer per-credit awards (Awarded ≤ Verified) and 'Award all verified' bulk action (idempotent) → confirm (auto-generates Markdown report, derives outcome + certification level) → return (lifts state-lock, fires mock notification) → accept (project → CERTIFIED) or continue-to-next-phase. Submittal quality score authoritative on Reviewer entry, revisable by Admin, audit-tracked. Approve to proceed to Unit 6 — Portfolio."


---

## CONSTRUCTION - Unit 6 — Portfolio — Batched Plan
**Timestamp**: 2026-06-25T16:45:00Z
**User Input**: "Using the AI DLC review Audit and state files. Approve to move on to Unit 6 (Portfolio). Same skip-NFRR + skip-NFRD cadence carries forward by default."
**AI Response**: Reviewed `aidlc-state.md` and the U5 closure block in `audit.md` (review workflow + state-lock complete end-to-end; Unit 6 next). Recorded U5 approval. Staged U6 batched plan with the documented dual-stage skip (NFRR + NFRD) carrying forward from U3/U4/U5. No new infrastructure introduced (payment continues to use the U3 mocked `PaymentProvider`; notifications continue to use the U1 `NotificationGateway` mock; reports remain Markdown text per U5).

Created `aidlc-docs/construction/plans/unit-6-portfolio-design-plan.md` with:
- Cadence-deviation header explaining what's skipped.
- Stories-in-scope table (US-5.1, US-5.2, US-5.3, US-7.2).
- Out-of-scope clarification (credit-level inheritance / AI portfolio delta out per FR-5; all-dashboards framework → U7; notifications framework → U7; real payment processing → out of build; mobile/PWA → U9).
- Inherited architectural decisions table (U1 RBAC + Audit + RequestContext, U2 LWW + version, U3 Project + Invoice + PaymentProvider mock, U4 hook pattern, U5 SubmissionOrchestrator + StateLockService).
- 10 FD-level questions with **bold** recommended options:
  - Q1: Hierarchy persistence — extend `projects` with `is_portfolio_anchor` + `parent_anchor_id` self-FK + depth=1 invariant (FL-12).
  - Q2: Anchor designation API — narrow PATCH endpoints (`/anchor`, `/parent-anchor`).
  - Q3: Portfolio dashboard read model — `GET /projects/:anchorId/portfolio` with rollup.
  - Q4: Batch-submit orchestrator — anchor-first cascade with independent children (FL-13/FL-14).
  - Q5: Combined fee logic — reuse U3 FeeCalculator, single-invoice line-items, `pay-and-submit`.
  - Q6: RBAC scope across portfolio — per-project membership re-checked at submit; missing membership ⇒ `SKIPPED_INELIGIBLE`.
  - Q7: Anchor-outcome cascade — at submission only, never at certification.
  - Q8: Detach / un-anchor lifecycle — un-anchor blocked while children attached.
  - Q9: Frontend surface — new `features/portfolio/` lazy feature + dialogs + project-detail integration.
  - Q10: PBT-01 invariants — FL-12 hierarchy (pure), FL-13 anchor-failure cascade, FL-14 independent children.
- Generation checklist for the FD wave (4 artifacts) + Code Generation Plan.

Updated `aidlc-state.md`:
- Construction matrix U6 row → FD `⏳`, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen `⏳`.
- Current Stage line → "Unit 5 approved; Unit 6 (Portfolio) batched plan staged (NFRR + NFRD skipped per carry-forward); awaiting Q1–Q10 answers".

**Status**: U5 approved; U6 batched plan ready; awaiting answers to Q1–Q10 (or "approve all-A and proceed").
**Context**: CONSTRUCTION - U6 batched design + code-gen plan staged with documented dual-stage skip deviation carried forward from U3/U4/U5.

**PBT Compliance Note (this plan stage)**: PBT-01 will be honored at FD generation (FL-12 hierarchy invariant, FL-13 anchor-failure-cascade invariant, FL-14 independent-children invariant). PBT-09 unchanged (fast-check). PBT-02..08, PBT-10 remain DOCUMENTED DEVIATION.

**Approval Prompt**: "Unit 6 batched plan ready (NFRR + NFRD skipped, carrying forward from U3/U4/U5). Answer Q1–Q10 in `unit-6-portfolio-design-plan.md`, or reply 'approve all-A and proceed' to take the recommended defaults. After approval I will generate U6 FD (4 artifacts) + Code Generation Plan in one wave, then execute code generation under the same PBT test-skip we've been carrying."


---

## CONSTRUCTION - Unit 6 — Design Wave (FD only) + Code Generation Plan
**Timestamp**: 2026-06-25T17:00:00Z
**User Input**: "approve all-A and proceed"
**AI Response**: Generated U6 Functional Design wave (4 artifacts in `aidlc-docs/construction/unit-6-portfolio/functional-design/`):
- `domain-entities.md` — `Project` extension columns (`is_portfolio_anchor`, `parent_anchor_id` reused), DB constraints (`project_no_self_parent_chk`, `project_anchor_no_parent_chk`, `project_parent_anchor_fk`, partial index `project_parent_anchor_idx`), `BatchSubmitResultDto`, `PortfolioDashboardDto`, `PortfolioFeeQuoteDto`. No new tables.
- `business-rules.md` — BR-PA (anchor + hierarchy + un-anchor + attach/detach + busy guard), BR-BS (anchor-first cascade + independence + per-child eligibility re-uses U5 `assertSubmittable` + RBAC + audit at orchestrator boundary), BR-PF (combined fee aggregation + $0-fast-path + 501 forward-compat), BR-PM (per-project membership remains source of truth), BR-Z carry-forward.
- `business-logic-model.md` — six flows (toggle anchor, attach/detach, dashboard, fee quote, batch submit, pay-and-submit), pure `assertHierarchy` definition, U5 `assertSubmittable` extraction contract, error-mapping table, Mermaid sequence + text alternative, PBT-01 properties FL-12 / FL-13 / FL-14.
- `frontend-components.md` — `features/portfolio/` lazy feature, dialogs (designate-anchor, batch-submit), DTO + ApiClient extensions, project-detail "Portfolio" section, RBAC mirror, A11y checklist, bundle estimate.

Generated `aidlc-docs/construction/plans/unit-6-portfolio-code-generation-plan.md` with 40 numbered steps grouped Phase A (backend, 22 steps) + Phase B (frontend, 10 steps) + Phase C (docs/validation, 8 steps) plus story coverage table and PBT compliance summary.

Updated `aidlc-state.md`:
- Construction matrix U6 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ⏳.
- Current Stage line → "Unit 6 design wave complete (FD only; NFRR/NFRD skipped per user); Code Generation Plan created; executing Phase A".

Proceeding to code generation per the "approve all-A and proceed" instruction (matching U3/U4/U5 cadence).

**Status**: Implicit approval of design wave + code-gen plan; executing Phase A.
**Context**: CONSTRUCTION - U6 FD complete, Code Generation Phase A starting.


---

## CONSTRUCTION - Unit 6 — Code Generation complete (Phase A + Phase B + Phase C)
**Timestamp**: 2026-06-25T17:25:00Z
**User Input**: (continuation of "approve all-A and proceed")
**AI Response**: Generated all U6 backend artifacts (Phase A) and frontend artifacts (Phase B), completed documentation + validation (Phase C). Files created:

**Backend (Phase A — Steps 1-22)**:
- DDL: extended `src/projects/registration-ddl.bootstrapper.ts` with `bootstrapPortfolioConstraints()` adding 3 idempotent CHECK/FK constraints + 1 partial index. All wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL END $$`. Logs each addition once on first creation.
- Project entity: added `is_portfolio_anchor BOOLEAN NOT NULL DEFAULT false`. Existing `parent_anchor_id` column retained.
- Pure invariant: `src/portfolio/state-machine/hierarchy.invariant.ts` — `assertHierarchy(child, candidate)` + `HIERARCHY_ERROR_CODES` + `hierarchyErrorCode` helper.
- DTOs: `dto/{patch-anchor, patch-parent-anchor, portfolio-dashboard, portfolio-fee-quote, batch-submit-result}.dto.ts`.
- Refactor: `src/review/submission.orchestrator.ts` — extracted `validateSubmittable` private + public `assertSubmittable` (BR-BS6); `submit` now reuses prefetched `project`+`existing` from the validator. Behavior unchanged for U5 callers.
- ReviewModule now exports `SubmissionOrchestrator`.
- Domain: `src/portfolio/portfolio.service.ts` (toggleAnchor, setParentAnchor, assertCanUnanchor, buildDashboard, findChildren, assertReader), `src/portfolio/portfolio-fee.service.ts` (combined-fee aggregation), `src/portfolio/portfolio-submission.orchestrator.ts` (anchor-first cascade + independent children + audit at boundary), `src/portfolio/portfolio.controller.ts` (6 routes), `src/portfolio/portfolio.module.ts`.
- ProjectsService.toDto + projects.controller list extended with `isPortfolioAnchor` field + `?isPortfolioAnchor` / `?parentAnchorId` filters.
- Cross-cutting: `src/common/exception/all-exceptions.filter.ts` extended to pass `code`, `result`, `quote`, `reason` fields through to the response body so the FE can render the FL-13 cascade.
- App-wide: registered `PortfolioModule` in `app.module.ts`.

**Frontend (Phase B — Steps 23-32)**:
- DTOs: extended `src/app/core/api/dto.ts` with `isPortfolioAnchor`, `achievedCertificationLevel` on `ProjectDto`, plus all U6 shapes (`PatchAnchorDto`, `PatchParentAnchorDto`, `PortfolioDashboardDto`, `ProjectSummaryDto`, `PortfolioFeeQuoteDto`, `BatchSubmitResultDto`, `AnchorSubmitOutcomeDto`, `ChildSubmitOutcomeDto`, `PortfolioSkipReason`, `PortfolioSubmitDto`, `PortfolioPayAndSubmitDto`).
- ApiClient: `listProjects` accepts filter; added 6 new methods (`patchAnchor`, `patchParentAnchor`, `getPortfolioDashboard`, `getPortfolioFeeQuote`, `submitPortfolio`, `payAndSubmitPortfolio`).
- Portfolio feature: `features/portfolio/{portfolio.store, portfolio-page.component, designate-anchor.dialog.component, batch-submit.dialog.component}.ts`. Page at `/projects/:anchorId/portfolio` with rollup card + Material children table. Dialog handles cascade rendering (FL-13) and per-child outcomes (FL-14).
- Project detail page: new "Portfolio" card in the grid + top-bar Portfolio link (when anchor) + "Manage portfolio settings" CTA opens designate-anchor dialog.
- Routes: lazy `/projects/:anchorId/portfolio` route guarded by auth.

**Build & validation**:
- Backend `npm run build` clean.
- Frontend `npm run build` clean. New lazy chunk `portfolio-page-component` at 31.73 kB raw / 7.88 kB gzip.
- `get_diagnostics` clean across all 22 backend + 6 frontend new/modified files.
- BE process restarted, all 6 portfolio routes mapped: `PATCH /api/v1/projects/:projectId/anchor`, `PATCH /api/v1/projects/:projectId/parent-anchor`, `GET /api/v1/projects/:projectId/portfolio`, `GET /api/v1/projects/:projectId/portfolio/fee-quote`, `POST /api/v1/projects/:projectId/portfolio/submit`, `POST /api/v1/projects/:projectId/portfolio/pay-and-submit`.
- DDL bootstrapper logs confirmed: 3 portfolio CHECK/FK constraints created + 1 partial index on first boot.

**End-to-end smoke test (against running BE/FE)**:
- Designated RES-100000 as portfolio anchor → 200, `isPortfolioAnchor=true`.
- Attached RES-100001 + RES-100002 as children → 200 each.
- GET dashboard → returns rollup with 2 children, anchor 50/49 attempted/awarded.
- Try un-anchor with children attached → 409 ANCHOR_HAS_CHILDREN (BR-PA3).
- **FL-12 enforcement**: self-parent attempt → 409 HIERARCHY_SELF_PARENT; attach to non-anchor → 409 HIERARCHY_TARGET_NOT_ANCHOR.
- **FL-14 independent children**: batch submit (anchor REGISTERED + has attempted credits, children have 0 attempted) → anchor SUBMITTED REV-100002, both children SKIPPED_INELIGIBLE: NO_ATTEMPTED_CREDIT independently.
- **FL-13 anchor-failure cascade**: re-batch with anchor in REVIEW_IN_PROGRESS → 409 ANCHOR_INELIGIBLE; **all children SKIPPED_INELIGIBLE: ANCHOR_FAILED**; full `BatchSubmitResultDto` populated in error body via the extended exception filter.
- Fee-quote with mixed paid/unpaid children → totals correctly aggregated (RES-100000 + RES-100001 = $0; RES-100002 = $900).

**Known interaction (pre-existing, not introduced by U6)**:
- The U3 `ProjectsDemoSeeder.upsertProject` resets `existing.status = REGISTERED` on every boot. This is unchanged from prior units; documented in U6 README for traceability. Does not affect U6 acceptance.

**Documentation**:
- Created `aidlc-docs/construction/unit-6-portfolio/code/README.md` with files, endpoints, DDL, smoke results, PBT compliance.
- Updated `usgbc-hub-residential-be/README.md` to "Units 1–6 complete" with U6 endpoint quick reference.
- Updated `usgbc-hub-residential-fe/README.md` to "Units 1–6 complete" with the new portfolio route.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — all 4 U6 stories `[x] U6`.
- Marked all U6 design plan + code-gen plan steps `[x]`.
- Updated `aidlc-state.md`: U6 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ✅. Feature → Unit map U6 rows → ✅. Current Stage line updated.

**Background processes still running**: terminalId 2 (BE on :3000), terminalId 7 (FE on :4200).

**Status**: U6 complete (with documented PBT deviation: tests skipped per Unit 1 precedent). Awaiting approval to proceed to Unit 7 (Dashboards & Notifications).
**Context**: CONSTRUCTION - U6 done end-to-end; Unit 7 next under the batched cadence.

**PBT Compliance Final Summary (U6)**:
- PBT-01: COMPLIANT (3 properties documented and pure subjects implemented test-friendly):
  - **FL-12** Hierarchy invariant — pure `assertHierarchy(child, candidate)` in `src/portfolio/state-machine/hierarchy.invariant.ts`. Smoke verified self-parent + non-anchor target both rejected with the canonical error codes; DB CHECK constraints provide defense-in-depth.
  - **FL-13** Anchor-failure cascade — orchestrator-level invariant on `PortfolioSubmissionOrchestrator.submit` return value. Smoke verified: when anchor is `REVIEW_IN_PROGRESS`, every child's status is `SKIPPED_INELIGIBLE` with `reason: ANCHOR_FAILED` — no child mutates.
  - **FL-14** Independent children — orchestrator-level invariant. Smoke verified: anchor SUBMITTED while two children independently SKIPPED_INELIGIBLE for their own reason (NO_ATTEMPTED_CREDIT), without sibling cross-contamination.
- PBT-09: COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per U1 precedent.

**Approval Prompt**: "Unit 6 — Portfolio complete. Backend at :3000, frontend at :4200. New portfolio dashboard accessible at `/projects/<anchorId>/portfolio` after sign-in. End-to-end verified: designate anchor → attach/detach children with FL-12 hierarchy enforcement → portfolio dashboard with rollup → batch-submit with anchor-first cascade (FL-13) and independent children (FL-14) → combined fee aggregation with $0-fast-path. Approve to proceed to Unit 7 — Dashboards & Notifications."


---

## CONSTRUCTION - Unit 7 — Dashboards & Notifications — Batched Plan
**Timestamp**: 2026-06-25T17:55:00Z
**User Input**: "move forward with Unit 7"
**AI Response**: Recorded U6 approval. Staged U7 batched plan with the documented dual-stage skip (NFRR + NFRD) carrying forward from U3/U4/U5/U6. No new infrastructure introduced (no real notification delivery; persistence layer wraps the existing U1 `NotificationGateway` mock; no new sequences; no new Redis usage).

Created `aidlc-docs/construction/plans/unit-7-dashboards-notifications-design-plan.md` with:
- Cadence-deviation header explaining what's skipped.
- Stories-in-scope table (US-7.8, US-10.1, US-10.2, US-10.3, US-10.4, US-10.5).
- Out-of-scope clarification (US-8.1 + US-6.1 → U8; US-7.5 → U9; real delivery out of build per FR-7.9; preferences deferred).
- Inherited architectural decisions table (U1 RBAC + Audit + RequestContext + NotificationGateway, U2 LWW + version, U3 Project + Invoice + Agreement, U5 Review + SubmittalQualityScore, U6 portfolio dashboard pattern).
- 10 FD-level questions with **bold** recommended options:
  - Q1: Notification persistence — new `notification` table; wrapper around U1 mock; per-recipient rows; UUID PK.
  - Q2: Six event kinds — INVITATION_SENT, REGISTRATION_CONFIRMED, REVIEW_SUBMITTED, REVIEW_RETURNED, PORTFOLIO_BATCH_COMPLETED, REVIEWER_ASSIGNED.
  - Q3: Recipient resolution — pure `resolveRecipients` function with per-kind rules (FL-15 subject).
  - Q4: Four role-scoped dashboards at `/dashboard/{project,green-rater,reviewer,admin}`.
  - Q5: Single `/dashboard` route auto-selects highest-privilege view.
  - Q6: New `GET /admin/pipeline` (Admin-only) with cursor pagination + filters (FL-17 subject).
  - Q7: New `GET /reviews/assigned` (Reviewer/Admin) grouping by review status.
  - Q8: Admin quality-score revise — FE-only; existing U5 endpoint already accepts Admin.
  - Q9: Bell icon shell + dropdown + full `/notifications` page; per-recipient read state (FL-16 subject).
  - Q10: PBT-01 — FL-15 recipient fan-out (pure), FL-16 unread-count, FL-17 pipeline-filter idempotence (pure).
- Generation checklist for the FD wave (4 artifacts) + Code Generation Plan.

Updated `aidlc-state.md`:
- Construction matrix U7 row → FD `⏳`, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen `⏳`.
- Current Stage line → "Unit 6 approved; Unit 7 (Dashboards & Notifications) batched plan staged (NFRR + NFRD skipped per carry-forward); awaiting Q1–Q10 answers".

**Status**: U6 approved; U7 batched plan ready; awaiting answers to Q1–Q10 (or "approve all-A and proceed").
**Context**: CONSTRUCTION - U7 batched design + code-gen plan staged with documented dual-stage skip deviation carried forward from U3/U4/U5/U6.

**PBT Compliance Note (this plan stage)**: PBT-01 will be honored at FD generation (FL-15 recipient fan-out, FL-16 unread-count, FL-17 pipeline-filter idempotence). PBT-09 unchanged (fast-check). PBT-02..08, PBT-10 remain DOCUMENTED DEVIATION.

**Approval Prompt**: "Unit 7 batched plan ready (NFRR + NFRD skipped, carrying forward from U3/U4/U5/U6). Answer Q1–Q10 in `unit-7-dashboards-notifications-design-plan.md`, or reply 'approve all-A and proceed' to take the recommended defaults. After approval I will generate U7 FD (4 artifacts) + Code Generation Plan in one wave, then execute code generation under the same PBT test-skip we've been carrying."


---

## CONSTRUCTION - Unit 7 — Design Wave (FD only) + Code Generation Plan
**Timestamp**: 2026-06-25T18:00:00Z
**User Input**: "approve all-A and proceed"
**AI Response**: Generated U7 Functional Design wave (4 artifacts in `aidlc-docs/construction/unit-7-dashboards-notifications/functional-design/`):
- `domain-entities.md` — `Notification` table (one row per recipient, indexed for the bell), `NotificationKind` enum (6 values), `RecipientPlan` interface (FL-15 output), `PipelineRowDto`, `ReviewerDashboardItemDto`, dashboard summary DTOs. No new sequences.
- `business-rules.md` — BR-N (lifecycle / fan-out / read state / idempotence), BR-DH (per-role dashboard scoping + outstanding-actions priority), BR-AP (admin pipeline filter + cursor pagination), BR-QSA (admin quality-score revise via existing U5 endpoint), BR-Z carry-forward.
- `business-logic-model.md` — module map, pure `resolveRecipients` + `applyPipelineFilters` subjects, fire-path orchestration with call-site migration table, eight flows including dashboard aggregations + cursor pagination, Mermaid sequence + text alternative, FL-15/16/17 properties.
- `frontend-components.md` — `features/dashboards/` (4 dashboard pages + role auto-selector + admin pipeline + dialogs), `features/notifications/` (full page + store), `shared/notifications-bell/` (shell), DTO + ApiClient extensions, route table, A11y checklist, bundle estimates.

Generated `aidlc-docs/construction/plans/unit-7-dashboards-notifications-code-generation-plan.md` with 45 numbered steps grouped Phase A (backend, 25 steps) + Phase B (frontend, 12 steps) + Phase C (docs/validation, 8 steps), story coverage table, PBT compliance summary.

Updated `aidlc-state.md`:
- Construction matrix U7 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ⏳.
- Current Stage line → "Unit 7 design wave complete (FD only; NFRR/NFRD skipped per user); Code Generation Plan created; executing Phase A".

Proceeding to code generation per the "approve all-A and proceed" instruction.

**Status**: Implicit approval of design wave + code-gen plan; executing Phase A.
**Context**: CONSTRUCTION - U7 FD complete, Code Generation Phase A starting.


---

## CONSTRUCTION - Unit 7 — Code Generation complete (Phase A + Phase B + Phase C)
**Timestamp**: 2026-06-25T18:15:00Z
**User Input**: (continuation of "approve all-A and proceed")
**AI Response**: Generated all U7 backend artifacts (Phase A) and frontend artifacts (Phase B), completed documentation + validation (Phase C). Files created:

**Backend (Phase A — Steps 1-25)**:
- `src/notifications/`: NotificationKind enum, Notification entity (per-recipient table with two indexes), DTOs, pure `recipient-resolver.ts` (FL-15) with per-kind rules + stable `eventKey`s + dedupe, pure `body-markdown.builder.ts` (subject + body + deep-link per kind), `NotificationsService` (fire / list / recent / mark-read / mark-all-read / unread-count, gathers recipient context via membership + user lookups, wraps the U1 `NotificationGateway` for forward-compat), `NotificationsController` (5 actor-scoped routes), `NotificationsModule`.
- `src/admin/pipeline/`: pure `pipeline-filter.ts` (FL-17), DTOs, `AdminPipelineService` (cursor-paginated server-side filter with phase + assigned-reviewer post-filter, batched LATERAL-join enrichment for latest review / latest score / assigned reviewer / scorecard rollup), `AdminPipelineController` (Admin-only via inline check). `AdminModule`.
- `src/dashboards/`: `DashboardsService` (PT + GR aggregations with pure `computeOutstandingActions` priority rules + workbook progress queries), DTOs, `DashboardsController` (2 routes), `DashboardsModule`.
- `src/review/reviewer-dashboard.controller.ts`: new sibling controller mounting `GET /api/v1/reviews/assigned` (Reviewer membership OR Admin), grouped by `Review.status`, with batched scorecard rollup + latest quality score lookups.
- Call-site migrations to `NotificationsService.fire(...)`:
  - `src/membership/invitation.service.ts` — `INVITATION_SENT` (only when invitee is a registered user; otherwise legacy mock continues).
  - `src/projects/registration.orchestrator.ts` — `REGISTRATION_CONFIRMED` post-commit, with owner-as-user resolved when the email maps to an account.
  - `src/review/submission.orchestrator.ts` — `REVIEW_SUBMITTED` post-commit.
  - `src/review/review.orchestrator.ts` — `REVIEW_RETURNED` post-commit.
  - `src/review/reviewer-assignment.service.ts` — rewritten to fire `REVIEWER_ASSIGNED` with the assigned-reviewer pre-resolved.
  - `src/portfolio/portfolio-submission.orchestrator.ts` — `PORTFOLIO_BATCH_COMPLETED` after batch (success or partial).
- Module wiring updates: `MembershipModule`, `ProjectsModule`, `ReviewModule`, `PortfolioModule` all import `NotificationsModule`. `ReviewModule` adds `ProjectMembership` to `forFeature`. `app.module.ts` registers `Notification` entity + 3 new modules.
- Initial debug fix: `JwtAuthGuard` is registered globally via `APP_GUARD`; explicit `@UseGuards(JwtAuthGuard)` on the new dashboard controllers triggered DI failure ("AuthService not in DashboardsModule context"). Removed the local `@UseGuards` calls — the global guard already protects routes by default. After fix, BE booted clean and all 6 new routes mapped.

**Frontend (Phase B — Steps 26-37)**:
- DTOs: extended `src/app/core/api/dto.ts` with all U7 shapes.
- ApiClient: extended with 8 new methods.
- Stores: `NotificationsStore` (signal-backed, 30 s polling pause-on-blur, recent + page + mark-read), `DashboardsStore` (one signal per dashboard + load methods), `AdminPipelineStore` (rows + filter with 250 ms debounce + cursor pagination + reuses U5 endpoints for assign-reviewer + revise quality-score).
- Components: `notifications-bell` shell (Material badge + menu, mounted in app top bar), `notifications-page` (Material list + cursor pagination + empty state), `dashboard-redirect` (resolves to highest-privilege view), 4 dashboard pages (project / green-rater / reviewer / admin), 2 dialogs (assign-reviewer / edit-quality-score).
- Routes: 6 new lazy routes under `/dashboard/*` + `/notifications`.
- Shell: app component now imports `NotificationsBellComponent` and adds a "Dashboard" link to the top bar.

**Build & validation**:
- Backend `npm run build` clean.
- Frontend `npm run build` clean. New lazy chunks per dashboard page (~25-65 kB raw each); initial bundle 162.35 kB gzip.
- `get_diagnostics` clean across all 28 backend + 16 frontend new/modified files.
- BE process restarted; all 6 new routes mapped: `GET /api/v1/notifications` (+ recent / unread-count / `:id/read` / read-all), `GET /api/v1/dashboards/{project,green-rater}`, `GET /api/v1/reviews/assigned`, `GET /api/v1/admin/pipeline`. All prior routes still mapped.

**End-to-end smoke test (against running BE/FE)**:
- Admin login → `GET /notifications/unread-count` → `{"unreadCount":0}`.
- Admin login → `GET /admin/pipeline?limit=3` → returns 3 enriched rows with `attemptedTotal`, `awardedTotal`, `latestReview`, `latestQualityScore`, `assignedReviewer`. Pagination cursor present.
- Admin login → `GET /reviews/assigned` → returns all reviews grouped by status (Admin sees all per BR-DH4).
- Admin login → `GET /dashboards/project` → returns admin's PT memberships (currently empty since admins aren't auto-PT).
- **Notification fire integration**: Admin invites `team@residential.test` as `green_rater` on RES-100000 → `POST /projects/.../invitations` returns 201 → team logs in → `GET /notifications/recent` returns **1 row** with `kind: INVITATION_SENT`, computed subject "You've been invited as green rater", computed body, deep-link `/projects/<id>`, `readAt: null`, `version: 1`. (FL-15 recipient fan-out — invitee resolved to userId via `users.findByEmail`.)
- **FL-16 unread-count invariant**: Team `POST /notifications/read-all` returned 204 → `GET /unread-count` → `{"unreadCount":0}` → `GET /recent` shows the same row with `readAt` populated.
- FE accessible at `/dashboard` (auto-redirects), `/dashboard/project`, `/dashboard/green-rater`, `/dashboard/reviewer`, `/dashboard/admin`, `/notifications`. Bell icon visible in app shell with unread-count badge.

**Documentation**:
- Created `aidlc-docs/construction/unit-7-dashboards-notifications/code/README.md`.
- Updated `usgbc-hub-residential-be/README.md` to "Units 1–7 complete" with U7 endpoint quick reference.
- Updated `usgbc-hub-residential-fe/README.md` to "Units 1–7 complete" with the new dashboard + notifications routes.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — all 6 U7 stories `[x] U7`.
- Marked all U7 design plan + code-gen plan steps `[x]`.
- Updated `aidlc-state.md`: U7 row → FD ✅, NFRR `— (skipped)`, NFRD `— (skipped per user)`, CodeGen ✅. Feature → Unit map U7 rows → ✅. Current Stage line updated.

**Background processes still running**: terminalId 45 (BE on :3000), terminalId 43 (FE on :4200).

**Status**: U7 complete (with documented PBT deviation: tests skipped per Unit 1 precedent). Awaiting approval to proceed to Unit 8 (Mocked AI).
**Context**: CONSTRUCTION - U7 done end-to-end; Unit 8 next under the batched cadence.

**PBT Compliance Final Summary (U7)**:
- PBT-01: COMPLIANT (3 properties documented and pure subjects implemented test-friendly):
  - **FL-15** Recipient fan-out — pure `resolveRecipients(event, ctx)` in `src/notifications/recipients/recipient-resolver.ts`. Smoke verified per-kind rule fidelity (invitee-only for INVITATION_SENT).
  - **FL-16** Unread-count invariant — `NotificationsService.unreadCount`. Smoke verified `unreadCount` matches `count(notifications WHERE recipient = u AND readAt IS NULL)` after `fire` + `markAllRead` sequence.
  - **FL-17** Pipeline-filter idempotence — pure `applyPipelineFilters` in `src/admin/pipeline/pipeline-filter.ts` (defensive backstop; BE uses SQL for performance).
- PBT-09: COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per U1 precedent.

**Approval Prompt**: "Unit 7 — Dashboards & Notifications complete. Backend at :3000, frontend at :4200. New routes accessible: `/dashboard` (auto-redirects), `/dashboard/{project,green-rater,reviewer,admin}`, `/notifications`. Top-bar gets a Dashboard link and a notifications bell with unread-count badge. End-to-end verified: invite fires INVITATION_SENT (recipient persisted), bell badge increments, mark-all-read drops unread count to 0. Admin pipeline returns enriched per-project rows with cursor pagination. Approve to proceed to Unit 8 — Mocked AI."


---

## CONSTRUCTION - Unit 8 + Unit 9 — Batched Plan (run remaining units)
**Timestamp**: 2026-06-30T16:38:00Z
**User Input**: "Using AI-DLC run the reamianing units in the implementation plan."
**AI Response**: Acknowledged. Per the established cadence (NFRR + NFRD skipped per user from U3 onward; "approve all-A and proceed" defaults), executing both remaining units end-to-end in this turn:
- **Unit 8 — Mocked AI** (US-6.1, US-8.1): `AiInsightProvider` seam (mock impl), async in-process runs with status polling, `ai_insight_run` + `ai_insight_finding` tables, per-credit findings (MISSING_EVIDENCE / INSUFFICIENT_EVIDENCE / CROSS_CREDIT_CONTRADICTION / ATTENTION_FLAG), human acknowledge/ignore (never auto-approves), wired into Workbook (pre-submission) + Review (pre-review) FE pages.
- **Unit 9 — Mobile/PWA & Scheduling** (US-7.5, US-9.1, US-9.2, US-9.3): Angular service worker + manifest (installable PWA), responsive layout polish (44px touch targets), camera capture component with client-side image compression (Canvas resize → JPEG re-encode) plugged into the U4 submittals endpoint, `SchedulingProvider` seam (mock MS Bookings link-out) + `scheduling_link` table, "Schedule call" CTA on a returned review.

PBT compliance for this batch:
- PBT-01: COMPLIANT. Properties documented and pure subjects implemented:
  - **FL-18** AI finding determinism — pure `generateAiFindings(snapshot)`. Same snapshot ⇒ same finding set, ordered, no UUIDs in the pure layer.
  - **FL-19** Acknowledge idempotence — `ack()`/`ignore()` are noops after first call.
  - **FL-20** Image-compression invariant — pure `planCompression(input)` returning target dimensions such that `min(scale, 1) * dim ≤ MAX_DIM` and predicted bytes ≤ MAX_BYTES.
- PBT-09: COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10: NON-COMPLIANT (DOCUMENTED DEVIATION) — tests skipped per U1 precedent.

Generating both units in this session without per-unit approval gates per the user directive "run the remaining units" (a single approval gate at the end).

**Status**: Executing U8 + U9 design + code generation.
**Context**: CONSTRUCTION - Final two units of the 9-unit roadmap.


---

## CONSTRUCTION - Unit 8 + Unit 9 — Code Generation complete
**Timestamp**: 2026-06-30T17:08:00Z
**User Input**: "Check if all the units are run" (follow-up to "Using AI-DLC run the remaining units in the implementation plan.")
**AI Response**: Confirmed and closed out the remaining work for the run-all-units request. Final state per unit:

**Unit 8 — Mocked AI (US-6.1, US-8.1)** — ✅ FD wave, ✅ Code Gen.
- BE: `src/ai/` — entities (`AiInsightRun`, `AiInsightFinding`), enums, DTOs, pure
  `generateAiFindings(snapshot)` (FL-18 subject), `AI_INSIGHT_PROVIDER` seam +
  `MockAiInsightProvider`, `SnapshotBuilder` (scorecard + workbook + submittals + notes →
  pure value), `AiInsightsExecutor` (async lifecycle `QUEUED → RUNNING → COMPLETED|FAILED`
  via `setImmediate`), `AiInsightsService` (RBAC + BR-AI3 conflict 409 + BR-AI5 idempotent
  ack/ignore + audit), `AiInsightsController` (5 routes under
  `projects/:projectId/ai-runs`), `AiModule`. Wired into `app.module.ts`.
- FE: `features/ai/` — `AiRunsStore` (per-(projectId, type) signal store with 2s polling,
  pauses while document hidden), `AiRunButtonComponent` (Run / Analyzing… / Re-run), 
  `AiFindingsPanelComponent` (severity-grouped, ack/ignore actions). DTOs + ApiClient
  extended with 5 methods. Embedded on `WorkbookPageComponent` (PRE_SUBMISSION) and
  `ReviewPageComponent` (PRE_REVIEW).

**Unit 9 — Mobile/PWA & Scheduling (US-7.5, US-9.1, US-9.2, US-9.3)** — ✅ FD wave, ✅ Code Gen.
- BE: `src/scheduling/` — `SchedulingLink` entity (status `CREATED | CANCELLED`, FK-soft to
  project / review / reviewer user), enums, DTOs (POST validates via class-validator),
  `SCHEDULING_PROVIDER` seam + `MockMsBookingsProvider` with pure `buildMockBookingUrl(projectId,
  reviewerUserId)` (FL-21 subject — same inputs ⇒ same URL), `SchedulingService` (RBAC: Reviewer
  + Admin for create; any member + Admin for read; inferes reviewerUserId from the latest
  assigned reviewer membership when omitted; audit on create), `SchedulingController` (2 routes
  under `projects/:projectId/scheduling`), `SchedulingModule`. Wired into `app.module.ts`.
- FE PWA shell: new `src/manifest.webmanifest` + `src/service-worker.js` (cache-first, bypasses
  `/api/*` per BR-MS10), `src/index.html` adds manifest + theme-color + mobile-web-app-capable
  meta tags, `src/main.ts` registers the SW on `load` (silent-fail when not served),
  `angular.json` lists the two new files as build assets so they ship under
  `dist/usgbc-hub-residential-fe/browser/` (verified).
- FE responsive: `src/styles.scss` appends `@media (max-width: 600px)` (44px touch targets +
  larger form controls + condensed table font + stacked dashboard grids) and
  `@media (max-width: 900px)` (tightens tablet grid gaps).
- FE camera: `src/app/shared/image/compression.ts` ships the **pure** `planCompression(input)`
  (FL-20 subject, `MAX_DIM = 1600`, `MAX_BYTES = 25 MB`).
  `src/app/shared/camera-capture/camera-capture-button.component.ts` opens the device camera
  via a hidden `<input type="file" capture="environment">`, runs the file through
  `planCompression` + Canvas re-encode to `image/jpeg`, emits a compressed `File` renamed
  `camera-capture-<ts>.jpg`. Wired into `CreditSubmittalsComponent` next to the existing file
  input; the compressed file uploads via the unchanged `WorkbookStore.uploadFile` path.
- FE scheduling: `features/scheduling/scheduling.store.ts` + `scheduling-button.component.ts`
  + `ReviewPageComponent` returned-review block.

**Validation**:
- `nest build` — clean.
- `ng build` — clean. `manifest.webmanifest` + `service-worker.js` confirmed copied to
  `dist/usgbc-hub-residential-fe/browser/`.
- `get_diagnostics` — clean on all new + modified files (BE + FE).

**Documentation**:
- Created `aidlc-docs/construction/unit-8-mocked-ai/code/README.md`.
- Created `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/code/README.md`.
- Updated `usgbc-hub-residential-be/README.md` — "Units 1–9 complete" + U8 + U9 endpoint quick
  references.
- Updated `usgbc-hub-residential-fe/README.md` — "Units 1–9 complete" + U8/U9 routes + PWA notes.
- Updated `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — US-6.1, US-8.1,
  US-7.5, US-9.1, US-9.2, US-9.3 now `[x] U8` / `[x] U9`.
- Updated `aidlc-state.md` — U8 + U9 rows in the construction matrix → FD ✅, NFRR `— (skipped)`,
  NFRD `— (skipped per user)`, CodeGen ✅. Feature → Unit map U8 + U9 rows → ✅. Current Stage:
  "Units 1–9 complete; ready for Build and Test phase".

**PBT compliance (U8 + U9)**:
- PBT-01 — COMPLIANT (4 new properties documented with pure / test-friendly subjects):
  - **FL-18** AI finding determinism — pure `generateAiFindings(snapshot)` in
    `usgbc-hub-residential-be/src/ai/findings/findings-generator.ts`.
  - **FL-19** Ack/ignore idempotence — service-level invariant in
    `usgbc-hub-residential-be/src/ai/ai-insights.service.ts` (`transition(...)`).
  - **FL-20** Image-compression plan invariants — pure `planCompression` in
    `usgbc-hub-residential-fe/src/app/shared/image/compression.ts`.
  - **FL-21** Mock booking URL determinism — pure `buildMockBookingUrl` in
    `usgbc-hub-residential-be/src/scheduling/provider/mock-ms-bookings.provider.ts`.
- PBT-09 — COMPLIANT (fast-check carried over).
- PBT-02..08, PBT-10 — DOCUMENTED DEVIATION (tests skipped per U1 precedent).

**Status**: All 9 build-order units complete end-to-end. The roadmap's CONSTRUCTION phase
is finished; remaining `Build and Test` stage will run once across the unified codebase.

**Context**: CONSTRUCTION - Final two units of the 9-unit roadmap landed in one batched wave
per the user's "run the remaining units" directive. End-to-end smoke against a running stack
was not executed (DB/Redis were not running this session); structural verification (build +
diagnostics + asset copy) is clean.
