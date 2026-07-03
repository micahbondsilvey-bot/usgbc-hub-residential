# Unit 1 — Business Logic Model

Describes the business processes (algorithms / flows) for Unit 1, technology-agnostic. Backed by the
entities (`domain-entities.md`) and rules (`business-rules.md`).

## BL-1 Login

**Inputs**: `email`, `password`.
**Outputs**: `{ accessToken, profile }` on success.
**Steps**:
1. Lowercase `email`. Look up `User` by email.
2. If not found OR `passwordHash` is null → return 401 (generic).
3. Compare `password` to `passwordHash` via bcrypt.
4. On match: update `lastLoginAt`. Build profile (`sub`, `email`, `name`, `globalRole`).
5. Issue access token containing identifiers only (no project roles).
6. Return `{ accessToken, profile }`.

**Errors**: 401 generic on any auth failure; 500 on infrastructure errors.

## BL-2 Resolve Authenticated User (per request)

**Inputs**: bearer token (and optional `projectId` from the route).
**Outputs**: `AuthUser` attached to request: `{ sub, email, globalRole, projectRole? }`.
**Steps**:
1. Verify the bearer token's signature, issuer, and expiry. On failure → 401.
2. Load `User` by `sub`. If missing → 401.
3. If route is project-scoped (carries `:projectId`), look up an active `ProjectMembership(user.id,
   projectId)`. Attach its `projectRole` to `AuthUser` (if any).
4. If no active membership and `globalRole != ADMIN` → leave `projectRole` undefined; downstream
   guards (BR-Z2) will deny.
5. Attach `AuthUser` to the request.

## BL-3 Authorization Decision Function (pure)

**Inputs**: `AuthUser`, `Action` descriptor (e.g., `{ kind: 'project', allowedProjectRoles: [...] }`),
optional `projectId`.
**Output**: `ALLOW | DENY`.
**Implementation**: BR-Z2 / BR-Z3.
**Properties** (PBT-target — see below):
- Determinism (same inputs → same output).
- Admin universal allow.
- Empty allowed-set on a project-scoped action denies all non-Admins.
- Membership inactivity (no `acceptedAt` or non-null `revokedAt`) denies non-Admins.

## BL-4 Invite User to Project

**Inputs**: `projectId`, `inviteeEmail`, `projectRole`, `actor` (the inviter).
**Outputs**: `Invitation` (state `PENDING`).
**Steps**:
1. Authorize the actor against BR-I1 (PT/GR may invite PT/GR; Reviewer invites Admin-only).
2. Find any existing `Invitation(projectId, inviteeEmail, state=PENDING)`. If found, transition it
   to `REVOKED` and proceed.
3. Generate a one-time random token (32 bytes URL-safe). Persist only its hash.
4. Compute `expiresAt = now + TTL` (default 7 days).
5. Persist a new `Invitation(state=PENDING, projectRole, expiresAt, tokenHash, invitedBy=actor.id)`.
6. Enqueue an invite notification (mocked email); the cleartext token is part of the link.
7. Return the persisted invitation (without the cleartext token; the token is in the notification only).

**Errors**:
- 403 if the actor is not allowed to invite this role.
- 404 if the project does not exist.
- 409 if a `(projectId, inviteeEmail)` already maps to an *active* `ProjectMembership` (the user is
  already a member); response includes the existing role.

## BL-5 Accept Invite

**Inputs**: cleartext `token`, optional new-account credentials `(email, password)` if no account.
**Outputs**: `{ membership, profile, accessToken }` (logs the user in if they were anonymous).
**Steps**:
1. Hash the token; look up an `Invitation` by `tokenHash`.
2. If not found → 410. If `state != PENDING` → 410. If `now > expiresAt` → transition to `EXPIRED`,
   return 410.
3. Resolve the user:
   - If authenticated, that user is the accepter (their `email` MUST match the invite's
     `inviteeEmail`, case-insensitive).
   - Else, if a User exists for `inviteeEmail` → require login on this endpoint.
   - Else (BR-I4), create a new User with `email = inviteeEmail`, `globalRole = USER`,
     `passwordHash = bcrypt(password)`, `emailVerifiedAt = now`.
4. Check `(user.id, projectId)` membership uniqueness (Q1=X):
   - If already has a membership with the same role → set invite to `ACCEPTED` (idempotent), return
     existing membership.
   - If has a membership with a different role → 409, with guidance.
5. Create `ProjectMembership(user.id, projectId, projectRole, invitedBy=invite.invitedBy,
   acceptedAt=now)`.
6. Set invite `state = ACCEPTED`, `acceptedAt = now`, `acceptedByUserId = user.id`.
7. Issue an access token; return `{ membership, profile, accessToken }`.

## BL-6 Decline Invite

**Inputs**: cleartext `token`.
**Outputs**: 200 OK.
**Steps**:
1. Hash token; find Invitation. If not `PENDING` → 410. If expired → mark `EXPIRED`, return 410.
2. Set `state = DECLINED`, `declinedAt = now`.

## BL-7 Revoke Invite

**Inputs**: `invitationId`, `actor`.
**Outputs**: 200 OK.
**Steps**:
1. Authorize: actor must be the inviter or an Admin.
2. If `state` is terminal → no-op (idempotent).
3. Else set `state = REVOKED`, `revokedAt = now`.

## BL-8 Expiry Tick

**Inputs**: `now`.
**Outputs**: count of invites/tokens expired.
**Steps**:
1. For each Invitation with `state = PENDING AND expiresAt < now` → set `EXPIRED`.
2. For each PasswordResetToken / EmailVerificationToken with `expiresAt < now AND usedAt IS NULL` →
   no state change required (treat as invalid on use); optional cleanup job is out of scope.

(The tick is invoked lazily on access of an invite/token AND optionally by a periodic schedule.
For PBT, time is injected and the tick can be invoked deterministically.)

## BL-9 Audit Stamping

**Inputs**: any insert/update on an entity inheriting `AuditBase`.
**Steps**:
1. The audit subscriber sets `createdAt = now`, `createdBy = actor.id` on insert.
2. On update, sets `updatedAt = now`, `updatedBy = actor.id`.
3. Ignores any client-supplied audit fields (stripped at DTO layer).
4. For state transitions and score/note changes (other units), `AuditService.record(...)` writes an
   `AuditLog` row with `before`/`after`/`reason`.

## BL-10 Demo Seed

**Steps** (idempotent, on startup):
1. For each configured seed identity, find by email.
2. If missing, create User with the configured global role and a freshly hashed password.
3. If present, update `globalRole` and `passwordHash` to match configuration (so demo creds remain valid).
4. Reconcile demo project memberships once Unit 3 has provisioned the demo project (Unit 1 publishes
   a hook that Unit 3's demo-data routine calls).

## BL-11 Profile Update

**Inputs**: `actor`, `patch`.
**Outputs**: updated `User`.
**Steps**:
1. Self-only by default; Admin may update any user.
2. Whitelist editable fields: `name`, `organization`, and `greenRaterCredentialId` (only if the user
   has any active `GREEN_RATER` membership; otherwise reject `greenRaterCredentialId` updates).
3. Persist; audit subscriber stamps the row.

## PBT-01 Testable Properties (this unit)

1. **Authorization decision function (pure)**:
   - Determinism: `decide(input) === decide(input)`.
   - Admin universality: any input with `globalRole = ADMIN` ⇒ ALLOW.
   - Empty allowed-set non-Admin: any project action with `allowedProjectRoles = []` ⇒ DENY for
     non-Admins.
   - Inactivity: a non-Admin with no active membership on the target project ⇒ DENY.
   - Stability under role rename: if we map a project role to itself, decision is unchanged.

2. **Invitation state machine (stateful)**:
   - Generated random sequences of valid commands (`create`, `accept`, `decline`, `revoke`, `expiry-tick`).
   - Invariant: no transition out of a terminal state.
   - Invariant: acceptance after `expiresAt` is impossible.
   - Invariant: at most one `PENDING` invite per `(projectId, inviteeEmail)`.
   - Invariant: revoke on terminal states is idempotent (state unchanged).

3. **Membership uniqueness**:
   - For any sequence of `create-membership`/`revoke-membership` commands, at any point at most
     one *active* membership exists per `(userId, projectId)` (Q1=X).

4. **Audit timestamp invariants** (entity-level):
   - For all rows: `updatedAt ≥ createdAt`.
   - For unchanged rows: `updatedAt` does not advance.
   - For any row: `createdAt` and `createdBy` are immutable after insert.

5. **Token consumption (round-trip / idempotence)**:
   - Hashing the cleartext token reproduces the persisted hash (round-trip).
   - Consumption is idempotent at the type level: applying `consume` to an already-used token does
     not change DB state and returns a stable error.

These properties carry into Code Generation as PBT test requirements; example-based tests will pin
the canonical scenarios (PBT-10).
