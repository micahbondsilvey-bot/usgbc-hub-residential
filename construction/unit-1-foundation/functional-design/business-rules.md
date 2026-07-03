# Unit 1 — Business Rules

Decision rules, validation logic, constraints, and policies for Platform Foundation. Technology-agnostic.

## Authentication

### BR-A1 Login
- Identity is `(email, password)`. Email is lowercased for matching.
- Password is verified against the bcrypt `passwordHash` on the user.
- A successful login issues a signed access token containing the user's stable identifiers
  (`sub`, `email`, `globalRole`). Project roles are NOT carried in the token; they are resolved at
  request time against `ProjectMembership` (avoids stale role on token after Admin revoke).
- Invalid email or password → 401, generic message ("invalid email or password"). No enumeration.
- Login records `lastLoginAt`. Failed logins do not.

### BR-A2 Password Policy (Q7=A)
- Minimum length: 8 characters.
- Hashing: bcrypt, cost 10.
- No further complexity rules in this build.
- Password reset and email verification follow the same min-length policy.

### BR-A3 Password Reset
- A user with a valid email may request a reset; success/failure responses are generic to prevent
  account enumeration.
- The system issues a one-time, time-bounded token (cleartext sent via mocked email; only the hash
  is persisted). TTL is configurable (default: 1 hour).
- A reset token is single-use (`usedAt` set on consumption). Expired or used tokens are rejected.
- On successful reset, all existing access tokens for that user are still valid (no session
  revocation in this build) — noted as a known limitation.

### BR-A4 Email Verification
- A new account starts unverified (`emailVerifiedAt = null`).
- Verification token is one-time and time-bounded (default TTL: 7 days).
- Verification status does not block login this build (kept as informational), but is exposed on
  the profile so future flows can require it.

## Authorization (Hybrid RBAC — Q1=C/X)

### BR-Z1 Roles
- `globalRole`: `ADMIN | USER`.
- `projectRole` (per-project): `PROJECT_TEAM | GREEN_RATER | REVIEWER`.
- A user holds **at most one** project role per project (Q1=X). Across different projects, a user
  may hold different roles.

### BR-Z2 Authorization Decision Function (pure)
For an action `A` on a project `P` by user `U`:
1. If `U.globalRole = ADMIN` → **ALLOW**. Admin bypasses state-locks and project-role checks.
2. Else if the action is platform-wide (no project context) → **DENY** unless explicitly listed as
   public (e.g., `/health`, `/auth/login`, accept-invite landing).
3. Else if there exists an active `ProjectMembership(U, P)` whose `projectRole` is in the action's
   allowed set → **ALLOW**.
4. Else → **DENY** (403).

"Active" means `acceptedAt IS NOT NULL AND revokedAt IS NULL`.

### BR-Z3 Action → Project-Role Allowed Set (foundation actions only)
Other units extend this matrix. Unit 1 owns:

| Action | Allowed project roles | Admin? |
|---|---|---|
| Read project membership list | PT, GR, REVIEWER | Yes |
| Invite user (PT/GR roles) | PT, GR | Yes |
| Invite user (REVIEWER role) | — | Yes only |
| Revoke pending invite | inviter or Admin | Yes |
| Revoke active membership | Admin | Yes |
| Update own profile | self | Yes (any user) |

(Other action sets — registration, scorecard, workbook, review, etc. — are owned by their units and
extend the same matrix.)

### BR-Z4 Identity Resolution per Request
On every protected request:
- The bearer token is verified.
- The user is loaded fresh from the DB (so a revoked Admin cannot continue acting Admin).
- For project-scoped routes, the route's `projectId` parameter is used to look up the user's active
  `ProjectMembership`; the membership's `projectRole` is the value evaluated by BR-Z2.

## Invitations (US-2.6, Q2=A, Q3=A)

### BR-I1 Who may invite which roles
- `PROJECT_TEAM` and `GREEN_RATER` members of project `P` may invite users to `P` with role
  `PROJECT_TEAM` or `GREEN_RATER`.
- `REVIEWER` invites are **Admin-only**.
- `ADMIN` may invite any role to any project.

### BR-I2 Lifecycle
- States: `PENDING → ACCEPTED | DECLINED | EXPIRED | REVOKED`. Terminal states do not transition.
- TTL: configurable (default 7 days).
- Re-inviting the same `(projectId, inviteeEmail)` while a `PENDING` invite exists supersedes it:
  the prior `PENDING` becomes `REVOKED`, then a new `PENDING` is created.
- Decline is voluntary by the invitee (or system on behalf of the user clicking decline).
- Expiry is set by a system tick comparing `expiresAt` to `now`. Once expired, acceptance is
  impossible — the user must request a new invite.
- Revoke is allowed by the inviter or any Admin while in `PENDING`. Revoking a terminal-state
  invitation is a no-op (idempotent).

### BR-I3 Acceptance
- Acceptance requires:
  - `state = PENDING`,
  - `now ≤ expiresAt`,
  - the cleartext token matches the persisted `tokenHash`,
  - the accepting user is authenticated (or completes registration on the spot — see BR-I4).
- On acceptance:
  - `state = ACCEPTED`, `acceptedAt = now`, `acceptedByUserId = U.id`.
  - A `ProjectMembership(U, P, projectRole)` is created if none exists.
  - If a membership for `(U, P)` already exists with a different role:
    - If the existing role equals the invite's role → idempotent no-op (membership already active).
    - If different → **the invite cannot be accepted** (Q1=X uniqueness on `(user, project)`); the
      caller is told to revoke the existing membership first (Admin) or accept under a different
      account.

### BR-I4 New-Account Acceptance
- If `inviteeEmail` does not correspond to an existing User, the accept-invite flow lets the invitee
  create an account (email + password) at the moment of acceptance. The account is created with
  `globalRole = USER` and `emailVerifiedAt = now` (since the invite was delivered to that email).
  The membership is then created.

## Audit Trail (US-11.3, Q5=A, Q6=A)

### BR-X1 Entity-Level Audit
- All entities inheriting `AuditBase` MUST have `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
  populated automatically by a global subscriber/interceptor. These fields are NOT settable from the
  API and are stripped from incoming DTOs.

### BR-X2 `modified_by` Identity (Q6=A)
- `createdBy` and `updatedBy` carry the actor's **User UUID**. Email and name are not stored on
  audit fields (read via join when needed).

### BR-X3 Append-Only Audit Log
- A separate `audit_log` table records `CREATE | UPDATE | DELETE | TRANSITION` events for entities
  that need a full change history (project status, review state, quality scores, verification
  notes) — these writers live in Unit 5/7 but use Unit 1's `AuditService.record(...)` helper.
- `AuditLog` rows are immutable at the application layer. There is no API to update or delete them.

### BR-X4 Time Source
- `createdAt`, `updatedAt`, `at`, `expiresAt` are persisted in UTC. The system uses a single
  monotonic clock helper (mockable in tests) so that PBT can drive deterministic time for invariants.

## Demo Seed (US-1.4, Q8=A)

### BR-S1 Seed Identities
On startup, seed the following if missing (idempotent):
- `admin@residential.test` — `globalRole = ADMIN`.
- `team@residential.test` — `globalRole = USER`; intended as a Project Team member of the demo project.
- `rater@residential.test` — `globalRole = USER`; intended as a Green Rater.
- `reviewer@residential.test` — `globalRole = USER`; intended as a Reviewer.
- A demo project (forward-declared shape; created in Unit 3 build, but Unit 1 ensures the demo
  account memberships are reconciled at startup once the project exists).

### BR-S2 Idempotency
- Seeding compares email and updates the password hash and `globalRole` to match the configured
  values on every restart. It does not create duplicate users or memberships.

### BR-S3 Demo-Mode Caveat
- Seed credentials are configurable via environment variables. They are documented as demo-only and
  must never be used in a production environment (the existing `MOCK_AUTH` production guard pattern
  is retained).

## Error Handling

### BR-E1 Authentication Errors
- Always return a generic 401 for invalid credentials. Never reveal which of email/password failed.

### BR-E2 Authorization Errors
- Unauthorized (no/invalid token) → 401.
- Authenticated but not allowed → 403 with a generic message; details are logged server-side.

### BR-E3 Validation Errors
- DTO validation failures → 400 with the violated field names. Whitelist + forbid-non-whitelisted is
  always on (retain prototype config).

### BR-E4 Invitation Errors
- Token mismatch / wrong state / expired → 410 (gone) for terminal states, 401 for token mismatch.
- Re-invite while PENDING supersedes silently (returns 200 with the new invite).

## Policies Carried into Other Units
- Audit base columns and the audit subscriber are consumed by every domain entity in Units 2–9.
- The hybrid RBAC matrix is **extended**, not replaced, by other units. Unit 1 owns the decision
  function and guards.
