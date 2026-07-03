# Application Design Plan — GBCI Certify: LEED Residential

**Purpose**: High-level component identification and service-layer design (not detailed business
logic — that comes in Functional Design per unit). Produces components, methods, services, and
dependency artifacts.

---

## Design Questions

Please answer each `[Answer]:` tag. Choose the last option (Other) to describe a custom preference.
My recommendation is noted, but the choice is yours.

### Question 1 — Authorization model: global roles vs per-project membership
Stories require inviting users to a specific project and granting "role-scoped access to that
project only" (US-2.6), while the existing prototype uses one global role per user. How should
authorization work?

A) Per-project membership — a user has a global account and a role per project (project-scoped RBAC); recommended given invite-to-project and multi-project participation

B) Global single role only (keep prototype model); ignore per-project scoping for now

C) Hybrid — global role for platform-wide actions (Admin) + per-project roles for Project Team/Green Rater/Reviewer

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 2 — Asynchronous (mocked) AI processing approach
The Technical Design calls for background workers (BullMQ/Redis) for AI checks. This build mocks AI
and runs locally. How should we implement the async behavior?

A) Simple in-process async with a simulated delay + status polling (no Redis); lightest for local/demo (recommended)

B) Real queue (BullMQ + Redis) even though AI is mocked, to mirror target architecture

C) Synchronous mock that returns immediately (no async UX), simplest but less realistic

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — LEED catalog & scorecard structure storage
The real LEED v4.1 SF catalog must be modeled (Q6=A). The Technical Design allows relational or JSON.

A) Fully relational tables (rating_system, category, credit, prerequisite, point_value) — queryable, strong integrity (recommended for the real catalog)

B) JSON document for scorecard structure with a thin relational wrapper (rating_system row + JSON blob)

C) Hybrid — relational catalog (credits/points) + JSON for flexible per-credit verification/submittal field definitions

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — External seam pattern (AI, storage, notifications, payments, MS Bookings)
How should mocked/deferred integrations be structured?

A) Provider-interface pattern: a TypeScript interface per seam with a Mock/Local implementation, selected by config/env (mirrors the existing auth-provider strategy); recommended

B) Direct mock services without formal interfaces (faster, less future-proof)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Backend API conventions
What conventions should the REST API follow?

A) Versioned base path `/api/v1`, resource-oriented routes, DTO validation + Swagger (extends current setup); recommended

B) Unversioned routes (keep current `/auth`-style flat paths)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Frontend architecture
How should the Angular 21 PWA be structured?

A) Feature-based lazy-loaded standalone components mirroring backend domains, Signals for state, a typed API client layer, Angular Material; per Technical Design (recommended)

B) Module-based (NgModules) structure instead of standalone components

C) Minimal SPA structure, refine later

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Cross-domain orchestration
Some actions span domains (e.g., submit-for-review → state-lock + notification + score context;
registration → invoice + email + project number). How should this be coordinated?

A) Orchestration services that call domain services directly (explicit, simple to trace); recommended for this scope

B) In-process domain events / event emitter (decoupled, more moving parts)

C) Mix — direct calls now, with an event seam where it clearly helps (e.g., notifications)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Module/unit alignment
Should backend feature modules map 1:1 to the proposed units from the execution plan (Foundation,
Catalog/Scorecard, Registration/Fees, Workbook, Review, Portfolio, Dashboards/Notifications, AI,
Mobile/PWA)?

A) Yes — one cohesive backend module (and matching frontend feature) per unit; recommended

B) Group some together (e.g., Scorecard+Workbook as one module); describe in Other

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (runs after answers approved)

- [x] Step A: Generate `components.md` — component definitions, purposes, responsibilities, interfaces.
- [x] Step B: Generate `component-methods.md` — method signatures with I/O types (business rules deferred to Functional Design).
- [x] Step C: Generate `services.md` — service definitions, responsibilities, orchestration patterns.
- [x] Step D: Generate `component-dependency.md` — dependency matrix, communication patterns, data flow.
- [x] Step E: Generate consolidated `application-design.md`.
- [x] Step F: Validate design completeness/consistency against requirements and stories.
