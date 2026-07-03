# Functional Design Plan — Unit 1: Platform Foundation

**Unit goal**: Hybrid RBAC (global Admin + per-project membership roles), users/profile, invitations,
audit trail, demo seed.

**Stories in unit**: US-1.1, US-1.2, US-1.3, US-1.4, US-2.6 (membership half), US-11.1, US-11.3.

**PBT-01 obligation**: Identify testable properties for any business logic in this unit and capture
them in the design (carried into Code Generation).

---

## Design Questions

Please answer each `[Answer]:` tag. Recommendations are noted; override as you wish.

### Question 1 — Multiple project memberships per user
Can one user hold **different roles on different projects** (e.g., Project Team on Project A, Green
Rater on Project B), and can they hold **multiple roles on the same project**?

A) Multi-project allowed; one role per (user, project) pair (recommended)

B) Multi-project allowed; multiple roles per (user, project) allowed

C) One project at a time per user; one role only

X) Other (please describe after [Answer]: tag below)

[Answer]: X There cannot be multiple roles per user on one project but a user may have different roles across projects.

### Question 2 — Who may invite which roles?
For US-2.6 invites:

A) Project Team and Green Rater can invite users in any project role; Admin can invite any role anywhere (recommended)

B) Project Team can only invite Project Team / Green Rater; Reviewer/Admin invites are Admin-only

C) Only Admin invites users to projects

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Invitation lifecycle
What lifecycle should an invitation follow?

A) States: pending → accepted | declined | expired | revoked. Token-based accept link; configurable TTL (e.g., 7 days). Re-invite supersedes previous pending invite for same (project, email). Recommended.

B) Simpler: pending → accepted | revoked (no expiry, no decline)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Reviewer assignment
Assigning a Reviewer to a project is the Admin's job (US-10.4). Should that assignment also be
modeled as a project membership row in this unit, or kept as a separate concept in Unit 7?

A) Model the Reviewer assignment as a `ProjectMembership` row created by Admin in Unit 7 reusing this unit's primitives (recommended — single source of truth for "who has what role on which project")

B) Keep Reviewer assignment as a separate concept in Unit 7

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Audit scope (what we capture)
US-11.3 requires `created_at`, `updated_at`, and `modified_by` on submittals, note columns, and
status changes. For Unit 1, what should our audit base provide?

A) Base entity columns (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`) auto-populated via a TypeORM subscriber, plus a separate `audit_log` table for status/score changes captured by Unit 5/7. Recommended.

B) Base entity columns only (no `audit_log`); status changes are inferred from row history

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Identifier for `modified_by`
What identifier should `modified_by` carry?

A) The user's UUID (stable, recommended)

B) The user's email (human-readable but mutable)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Password policy
Login already requires min length 8 in the prototype. For this build:

A) Keep min 8; bcrypt cost 10; no further complexity rules (matches prototype). Recommended for demo/foundation.

B) Tighten — min 12, mixed character classes

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Demo seed identities
Per US-1.4, what should the seeded demo set contain?

A) One account per global role: `admin@…` (Admin) plus seeded **memberships** that put a Project Team user, a Green Rater user, and a Reviewer user on a seeded demo project (recommended — exercises all four roles end-to-end)

B) Just one account per global role; no demo project/memberships

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 9 — Frontend feature scope in Unit 1
The unit's frontend slice is auth/profile + interceptors/guards. Should the frontend also include
the **invite acceptance landing page** (token in URL → accept → land on the project)?

A) Yes — include invite-accept page in Unit 1 (recommended; pairs with the membership backend)

B) No — defer invite UI to Unit 3 (registration's invite-from-project view)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (runs after answers)

- [x] Step A: Generate `aidlc-docs/construction/unit-1-foundation/functional-design/domain-entities.md` (User, ProjectMembership, Invitation, audit base, AuditLog).
- [x] Step B: Generate `aidlc-docs/construction/unit-1-foundation/functional-design/business-rules.md` (RBAC matrix, invitation lifecycle, audit semantics, password policy).
- [x] Step C: Generate `aidlc-docs/construction/unit-1-foundation/functional-design/business-logic-model.md` (login, resolve user, invite, accept-invite, RBAC check, audit stamping flows).
- [x] Step D: Generate `aidlc-docs/construction/unit-1-foundation/functional-design/frontend-components.md` (auth, profile, invite-accept screens with state/forms/validation/API endpoints).
- [x] Step E: Identify and document **PBT-01 testable properties** for this unit (RBAC decision function, invitation state machine, audit timestamp invariants).
