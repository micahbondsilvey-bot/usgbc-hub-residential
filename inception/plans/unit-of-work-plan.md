# Unit of Work Plan — GBCI Certify: LEED Residential

**Purpose**: Decompose the system into units of work, define dependencies, and map stories to units.
The execution plan proposed 9 units; the application design (Q8=A assumed) maps backend modules 1:1
to those units. These questions confirm/refine that decomposition.

**Terminology** (per Units Generation rules):
- **Service** = independently deployable component.
- **Module** = logical grouping inside a service.
- **Unit of Work** = planning grouping of stories.

This build is **brownfield, two services**: the existing NestJS backend (`usgbc-hub-residential-be`,
restructured) and a new Angular 21 PWA frontend (`usgbc-hub-residential-fe`). Within each service,
units correspond to feature modules.

---

## Planning Questions

Please answer each `[Answer]:` tag. Recommendations are noted; they are yours to override.

### Question 1 — Story-grouping criterion
Which criterion should drive unit boundaries?

A) Application Design module map (1:1 with the 9 modules already designed); recommended — preserves cohesion and matches the proposed build sequence

B) Persona-led grouping (one unit per role's primary workflow)

C) User journey-led grouping (e.g., "register a project end-to-end" as one unit cutting across modules)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Unit count / merging
The execution plan proposed 9 units. Should we merge any?

A) Keep 9 units as proposed; recommended — each is independently meaningful and respects the build order

B) Merge Catalog & Scorecard into one unit (they ship together in practice)

C) Merge Dashboards & Notifications + Mocked AI into one "platform aggregations" unit

D) Both B and C

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Frontend slicing relative to backend units
Each backend unit has a matching frontend feature. Within a unit:

A) Backend slice and matching frontend slice land in the SAME unit (delivered together); recommended — keeps end-to-end value per unit

B) Backend-only units first, then a "frontend wave" later

C) Frontend leads with mocks against an OpenAPI contract, backend follows

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Cross-unit dependencies / shared resources
Inter-unit communication is in-process DI within the NestJS service (per Application Design Q7=A).
Are there additional shared concerns to formalize at unit boundaries?

A) Standard set: shared types/DTOs, audit interceptor, RBAC guards, provider-seam interfaces; recommended

B) Plus a shared events module (notification fan-out as events)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Team alignment
Is unit ownership single-team or split?

A) Single team owns all units (typical for this build); recommended

B) Split (describe in Other)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Per-unit deployability
Should units be independently deployable, or all-or-nothing?

A) All units deploy together as the single backend service + the single frontend service (since the system is a 2-service monolith pair this build); recommended — matches local-only scope

B) Independently deployable per unit (would require microservices; out of scope this build)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Build/delivery sequence
The execution plan proposed: 1 Foundation → 2 Catalog/Scorecard → 3 Registration/Fees → 4 Workbook
→ 5 Review/State-Lock → 6 Portfolio → 7 Dashboards/Notifications → 8 Mocked AI → 9 Mobile/PWA + Scheduling.

A) Adopt as-is; recommended — foundational first, dependent units later

B) Move Dashboards earlier (after Registration) so demos light up sooner

C) Move Mocked AI earlier (after Workbook) to demo AI-assisted submission sooner

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Brownfield code organization
The existing backend lives at `usgbc-hub-residential-be/src/`. Should new module code be added under
that path?

A) Yes — restructure the existing backend in-place, add new module folders under `usgbc-hub-residential-be/src/`; create a new `usgbc-hub-residential-fe/` for the Angular PWA; recommended

B) Create a new backend folder alongside the existing one and migrate

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (Part 2 — runs after plan approval)

- [x] Step A: Generate `aidlc-docs/inception/application-design/unit-of-work.md` with unit definitions, responsibilities, and brownfield code organization notes.
- [x] Step B: Generate `aidlc-docs/inception/application-design/unit-of-work-dependency.md` with the dependency matrix and integration approach.
- [x] Step C: Generate `aidlc-docs/inception/application-design/unit-of-work-story-map.md` mapping every story (and cross-cutting story) to a unit.
- [x] Step D: Validate — every story is assigned, no circular dependencies, build sequence is consistent with dependencies.
