# Unit 1 — Domain Entities

Technology-agnostic domain model for Unit 1 (Platform Foundation). Field types are indicative;
exact column types are settled in Code Generation. All entities inherit `AuditBase` (Q5=A, Q6=A).

## AuditBase (mixin / abstract)
Shared columns auto-populated by an audit subscriber (Q5=A):
- `createdAt: DateTime` — set on insert.
- `updatedAt: DateTime` — set on insert and every update.
- `createdBy: UUID | null` — actor user id at insert (null only for system seed).
- `updatedBy: UUID | null` — actor user id at most recent update.

Invariants (carried to PBT):
- `updatedAt ≥ createdAt` always.
- For unchanged rows, `updatedAt` does not change.
- `createdAt` is immutable after insert; `createdBy` is immutable after insert.

## User
- `id: UUID` (PK)
- `email: string` (unique, lowercased; format-validated)
- `name: string | null`
- `organization: string | null`
- `greenRaterCredentialId: string | null` — present only when `globalRole = GREEN_RATER` (or any user
  who is *primarily* a Green Rater). Field is `null` for other identity types.
- `passwordHash: string | null` — bcrypt; null only for non-local future identities (Auth0).
- `globalRole: GlobalRole` — enum: `ADMIN | USER`. Hybrid model (Q1=C):
  - `ADMIN` → platform-wide R/W; bypasses state-locks; can invite anyone, anywhere.
  - `USER` → no platform-wide privileges; capabilities derived from per-project memberships.
- `emailVerifiedAt: DateTime | null`
- `lastLoginAt: DateTime | null`
- inherits `AuditBase`.

Constraints:
- `email` unique (case-insensitive).
- `globalRole` defaults to `USER`.

## ProjectMembership
A user's role on a specific project (Q1=X / Q4=A).
- `id: UUID`
- `userId: UUID` (FK → User)
- `projectId: UUID` (FK → Project, defined in Unit 3; Unit 1 only defines the FK column shape and a
  forward-declared placeholder until Unit 3 lands)
- `projectRole: ProjectRole` — enum: `PROJECT_TEAM | GREEN_RATER | REVIEWER`
- `invitedBy: UUID | null`
- `acceptedAt: DateTime | null` — null while membership originated as an invite still pending; set
  when the invite is accepted, OR set on direct creation by Admin (no invite step).
- `revokedAt: DateTime | null` — non-null when membership has been revoked.
- inherits `AuditBase`.

Constraints (uniqueness):
- **Unique on `(userId, projectId)`** — at most one role per (user, project), preventing multi-role
  on the same project (Q1=X).
- A user may have many memberships across different projects (different roles allowed).
- `revokedAt IS NULL` indicates an active membership.

Notes:
- `Reviewer` assignment by an Admin (Unit 7) is just a `ProjectMembership` row with
  `projectRole = REVIEWER` (Q4=A) — single source of truth.

## Invitation
Token-based invite to take a role on a project (US-2.6, Q3=A).
- `id: UUID`
- `projectId: UUID`
- `inviteeEmail: string` (lowercased)
- `projectRole: ProjectRole`
- `tokenHash: string` — stored as a hash of a one-time random token; the cleartext token is sent
  via the (mocked) email and never persisted.
- `state: InvitationState` — enum: `PENDING | ACCEPTED | DECLINED | EXPIRED | REVOKED`
- `expiresAt: DateTime`
- `acceptedAt: DateTime | null` — set when a user accepts.
- `declinedAt: DateTime | null`
- `revokedAt: DateTime | null`
- `invitedBy: UUID` — actor user id.
- `acceptedByUserId: UUID | null` — the user that accepted (created on the fly if no account exists yet).
- inherits `AuditBase`.

Constraints:
- At most one row with `state = PENDING` per `(projectId, inviteeEmail)` — re-invite supersedes
  the prior pending invite (the prior one transitions to `REVOKED`).
- Accepting requires `state = PENDING` and `now <= expiresAt` and the supplied token matches `tokenHash`.

State machine:
```
            create (Admin/PT/GR)
PENDING  ────────────────────────►
   │
   │ accept (token, by user)             ACCEPTED
   ├───────────────────────────────────►
   │
   │ decline (by user)                   DECLINED
   ├───────────────────────────────────►
   │
   │ now > expiresAt (system tick)       EXPIRED
   ├───────────────────────────────────►
   │
   │ revoke (inviter or Admin)           REVOKED
   └───────────────────────────────────►
ACCEPTED, DECLINED, EXPIRED, REVOKED  (terminal)
```

Invariants (carried to PBT):
- No transition is permitted out of a terminal state.
- Acceptance after `expiresAt` is impossible (must transition through `EXPIRED` first via the system tick).
- Revoke on a terminal state is a no-op (idempotent).

## PasswordResetToken
- `id: UUID`
- `userId: UUID`
- `tokenHash: string` — cleartext token never persisted; sent via the (mocked) email.
- `expiresAt: DateTime`
- `usedAt: DateTime | null`
- inherits `AuditBase`.

Constraints:
- A token may be used at most once (`usedAt` immutable once set).
- `expiresAt > createdAt`.

## EmailVerificationToken
- `id: UUID`
- `userId: UUID`
- `tokenHash: string`
- `expiresAt: DateTime`
- `usedAt: DateTime | null`
- inherits `AuditBase`.

Constraints: same as `PasswordResetToken`.

## AuditLog
Append-only log for status / score / note changes captured by other units (Q5=A).
- `id: UUID`
- `entityType: string` — e.g., `Project.status`, `Review.state`, `QualityScore`, `VerificationNote.column`.
- `entityId: UUID`
- `action: AuditAction` — enum: `CREATE | UPDATE | DELETE | TRANSITION`.
- `actorUserId: UUID | null` — null for system-driven events (e.g., expiry tick).
- `at: DateTime` — the moment the event occurred.
- `before: JSON | null` — prior values for changed fields (omitted for `CREATE`).
- `after: JSON | null` — new values for changed fields (omitted for `DELETE`).
- `reason: string | null` — free-text optional context.

Constraints:
- Append-only at the application layer (no `UPDATE`/`DELETE` API surface).
- `at` is set by the writer once and never amended.

## Enumerations
- `GlobalRole`: `ADMIN`, `USER`.
- `ProjectRole`: `PROJECT_TEAM`, `GREEN_RATER`, `REVIEWER`.
- `InvitationState`: `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `REVOKED`.
- `AuditAction`: `CREATE`, `UPDATE`, `DELETE`, `TRANSITION`.

## Relationships (text)
- `User 1 ─ * ProjectMembership` (a user can hold memberships across projects).
- `Project 1 ─ * ProjectMembership` (a project has many members; FK lives here, project lives in Unit 3).
- `Project 1 ─ * Invitation` (FK forward-declared).
- `User 1 ─ * Invitation` via `invitedBy` and `acceptedByUserId`.
- `User 1 ─ * PasswordResetToken / EmailVerificationToken`.
- `AuditLog` is loosely coupled by `(entityType, entityId)`; no FK constraints.

## Out-of-Scope (this unit)
- The `Project` entity itself — defined in Unit 3.
- Status / quality-score change *writers* — owned by Unit 5/7; this unit only provides the
  `AuditLog` shape and writer helper.
