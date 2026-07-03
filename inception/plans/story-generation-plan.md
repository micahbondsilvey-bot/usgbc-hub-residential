# Story Generation Plan — GBCI Certify: LEED Residential

**Role**: Product Owner
**Purpose**: Convert the approved requirements into user-centered stories with acceptance criteria and
a matching persona set, ready for Workflow Planning and Units Generation.

---

## Planning Questions

Please answer each question by filling in the letter after the `[Answer]:` tag. Choose the last
option (Other) to describe a custom preference.

### Question 1 — Story Breakdown Approach
How should stories be organized?

A) Feature-based — grouped by the FR areas (Account Mgmt, Registration, Scorecard, Workbook, Portfolio, Review, AI, Dashboards, Mobile)

B) Persona-based — grouped by role (Project Team, Green Rater, Reviewer, Admin)

C) Epic-based — hierarchical epics (one per feature area) with child stories

D) Hybrid — Epics per feature area, with stories tagged by persona (recommended for this scope)

X) Other (please describe after [Answer]: tag below)

[Answer]: D

### Question 2 — Story Granularity
What level of granularity do you want?

A) Coarse — one story per major capability (fewer, larger stories)

B) Medium — stories sized to a single user goal, INVEST-compliant (recommended)

C) Fine — small stories split to individual screens/actions (many small stories)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 3 — Acceptance Criteria Format
Which acceptance-criteria style do you prefer?

A) Given/When/Then (Gherkin-style) — explicit and testable (recommended, pairs well with PBT)

B) Bullet checklist of conditions

C) Narrative prose

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 4 — Story Prioritization / Sequencing
Should stories carry a priority or build-sequence indicator (e.g., MoSCoW or a 1..n order) to guide
Workflow Planning and Units Generation?

A) Yes — MoSCoW (Must/Should/Could/Won't-this-build)

B) Yes — a simple suggested build order (foundational → dependent)

C) No — leave sequencing entirely to Workflow Planning

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 5 — Mocked/Deferred Seams in Stories
For the mocked or deferred capabilities (AI insights, payments, email delivery, S3 storage, MS
Bookings), how should stories represent them?

A) Write stories for the full intended behavior, and note the mock/deferral in acceptance criteria (recommended)

B) Write stories only for the mocked behavior actually built this cycle

C) Split into two: a "this build (mocked)" story and a "future (real)" story per seam

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 6 — Non-Functional / Cross-Cutting Stories
Should the plan include explicit stories for cross-cutting concerns (RBAC enforcement, audit
trails/timestamps, state-locking, mobile responsiveness, accessibility), or fold them into
acceptance criteria of feature stories?

A) Separate cross-cutting/technical stories where it adds clarity (recommended for RBAC, state-locking, audit)

B) Fold all cross-cutting concerns into feature-story acceptance criteria only

C) Both — separate stories for RBAC/state-locking/audit; fold the rest into acceptance criteria

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Persona Detail Level
How detailed should personas be?

A) Lightweight — name, role, goals, key permissions, pain points

B) Standard — adds context of use, devices (mobile/desktop), frequency, success metrics (recommended)

C) Rich — full archetype with scenarios and journey notes

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Execution Checklist (Part 2 — runs after plan approval)

- [x] Step A: Generate `personas.md` with the four roles as archetypes at the chosen detail level,
      reflecting the expanded permissions from requirements (invite users, edit registration,
      Green Rater registers/pays on behalf, read-only reviewer comments, etc.).
- [x] Step B: Generate `stories.md` using the approved breakdown approach and granularity.
- [x] Step C: Cover all feature areas FR-1..FR-11 and key NFR cross-cutting concerns per the chosen option.
- [x] Step D: Write acceptance criteria for each story in the approved format.
- [x] Step E: Ensure every story satisfies INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable).
- [x] Step F: Apply prioritization/sequencing indicator per the chosen option.
- [x] Step G: Represent mocked/deferred seams per the chosen option.
- [x] Step H: Map each persona to the stories they participate in.
- [x] Step I: Add a traceability column/note linking stories back to FR/NFR IDs.
- [x] Step J: Validate coverage (every FR area has at least one story; role permissions fully represented).

---

## Methodology Notes
- Assume the Product Owner role; keep stories user-centered ("As a <role>, I want <goal>, so that <value>").
- Stories remain implementation-agnostic; technical "how" is deferred to Application Design / Construction.
- PBT is enabled — acceptance criteria for logic-heavy stories (scorecard, fees, review state) should
  state invariants explicitly so they can be carried into property identification during design.
