# Unit 1 — NFR Design Patterns

How Unit 1's NFRs (`nfr-requirements.md`) translate into concrete design patterns. Decisions
recorded from the NFR Design plan: Q1=B (Redis throttler), Q2=B (controller-interceptor audit),
Q3=A (lazy expiry), Q4=A (best-effort send), Q5=A (standard FE resilience), Q6=A (AsyncLocalStorage),
Q7=A (SHA-256 of `randomBytes(32)`), Q8=A (explicit `AuditService.record`).

## Security Patterns

### S-1 Token-based stateless auth (HS256)
- **Pattern**: The backend issues an HS256 JWT containing only stable identifiers (`sub`, `email`,
  `globalRole`). Project roles are NOT in the token; resolved per-request from `ProjectMembership`
  to avoid stale role on revoke (BR-Z4).
- **Why**: Stateless, scales horizontally later, simple for a local demo.
- **Counter-balance**: Sliding sessions / refresh tokens deferred (NFR-U1-4.1).

### S-2 Per-IP rate-limiting (Redis-backed) — Q1=B
- **Pattern**: `@nestjs/throttler` (v4) backed by a custom `ThrottlerStorage` implementation that
  talks to Redis via `ioredis`. Limits applied per route per Functional Design BR-A1/BR-A3 and
  NFR-U1-4.3:
  - `POST /api/v1/auth/login` — 10/min, 30/hr.
  - `POST /api/v1/auth/password/reset/request` — 5/min, 20/hr.
  - `POST /api/v1/invitations/accept` — 10/min, 30/hr.
- **Why Redis**: chosen over in-memory to mirror the target architecture's throttling semantics
  (cluster-coherent counters); it also positions the system to add other distributed primitives later.
- **Why a custom storage adapter**: the published `nestjs-throttler-storage-redis` package only
  ships peer-deps for throttler v5+. The project is on Nest 9 / throttler v4, so we implemented the
  ~30-line `ThrottlerStorage` contract ourselves directly against `ioredis`.
- **Trade-off**: introduces a Redis runtime dependency to the local Docker Compose stack. Documented in
  `tech-stack-decisions.md`; `.env` gains `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.

### S-3 One-time tokens (high-entropy, hashed at rest) — Q7=A
- **Pattern**: tokens generated via `crypto.randomBytes(32)`, encoded URL-safe (~43 chars). Persisted
  as `SHA-256(token)`; lookup uses constant-time compare. Cleartext appears only in the (mocked)
  notification link.
- **Why**: 256 bits of entropy makes brute-force infeasible; SHA-256 is fast, keeps hot-path lookup
  cheap (vs bcrypt). Single-use enforcement via `usedAt`/`state` columns.
- **Coverage**: Password reset, email verification, invitation.

### S-4 Generic error semantics
- **Pattern**: Auth and invite endpoints respond with generic error codes/messages so wrong
  credentials, missing accounts, and stale tokens are indistinguishable to clients (BR-A1, BR-E4).

### S-5 Defense-in-depth retained from prototype
- `helmet()` headers, restricted CORS, `ValidationPipe` (whitelist + forbidNonWhitelisted), masked
  logging.

## Resilience Patterns

### R-1 Best-effort mocked notifications — Q4=A
- **Pattern**: Token/invite is persisted *first*; the (mocked) notification send is invoked after
  commit. If the send fails, the operation still succeeds; the failure is logged, and the user can
  request a re-send (re-issue token / re-invite).
- **Why**: Aligns with the mocked-delivery posture; avoids transactional-outbox complexity for a
  local demo.
- **Note**: When notifications become real (Unit 7), this can be tightened with an outbox pattern
  without touching Unit 1's domain logic.

### R-2 Lazy expiry transitions — Q3=A
- **Pattern**: No background scheduler. On every read of an `Invitation` /
  `PasswordResetToken` / `EmailVerificationToken`, the service compares `expiresAt` to `now`. If the
  token is `PENDING` (or unused) and expired, it transitions to `EXPIRED` (or is treated as invalid)
  inline — a single UPDATE in the same query path.
- **Why**: Simpler, avoids deploying a scheduler in local-only environments; expiry is observable
  exactly when access is attempted, which is sufficient.
- **Determinism for tests**: The clock helper `now()` is injectable, enabling PBT to drive the
  state machine deterministically. An optional admin-only endpoint runs the tick on demand for
  exhaustive sweeps in tests.

### R-3 Frontend resilience (auth) — Q5=A
- **Pattern**: `authInterceptor` attaches the bearer token; on `401`, clears local state and routes
  to `/login` with a `redirectTo` query param. On transient `5xx`, no automatic retry; the
  `errorInterceptor` surfaces a friendly message and lets the user retry manually.
- **Why**: Auto-retries on `5xx` for write operations (login, accept-invite) risk duplication when
  the upstream actually succeeded; explicit retry is safer.

### R-4 Bounded retries on infrastructure
- DB connection: 3 startup retries with 3 s backoff (existing prototype pattern). No app-level
  retry on transient query errors — fail fast and let the caller retry.

## Performance Patterns

### P-1 Stateless hot paths
- Login, profile, role-check do single bcrypt or single index lookup. Targets met (NFR-U1-2.1).
- Index on `users.email`, `project_memberships(userId, projectId)` (unique), `invitations(tokenHash)` (unique),
  `password_reset_tokens(tokenHash)` (unique), `email_verification_tokens(tokenHash)` (unique).

### P-2 Connection pooling
- Pool size 10 / idle 30 s / connect timeout 10 s (Q7=A in NFR Reqs). No long-running transactions
  in this unit.

### P-3 No caching in this unit
- Profile and role lookups are cheap and need to reflect Admin revokes immediately (BR-Z4). Caching
  added later if profiling shows a need.

## Observability Patterns

### O-1 Structured logging with masking
- Reuse the existing `Logger` and `mask.util`. Each auth/invite event logs: `event`, `actorUserId`,
  `outcome`, masked email, `requestId` (from RequestContext), `roleAffected`, `projectId` where
  applicable. Passwords, password hashes, and cleartext tokens are never logged.

### O-2 Request correlation
- A NestJS middleware assigns `requestId` (UUID v4) per request, stored in the AsyncLocalStorage
  `RequestContext`. `Logger`, `AuditService`, and the Throttler key extractor all read from it.

### O-3 Audit log (explicit) — Q8=A
- Domain services that perform state transitions or score changes call
  `AuditService.record({ entityType, entityId, action, before, after, actorUserId, reason? })`
  inside the same DB transaction as the change.
- **Why**: Explicit calls keep the trail accurate and avoid the over-fan-out of a column-watching
  subscriber across the whole schema.

## Quality Patterns

### Q-1 Property-Based Testing (full enforcement)
- `fast-check`, ≥100 runs/property; CI seeded via `FAST_CHECK_SEED`; local seed logged.
- **Properties tested in this unit** (PBT-01 carry-over):
  1. Authorization decision function (deterministic, Admin universal, inactivity denial, etc.).
  2. Invitation state machine (no exit from terminal states; no acceptance after expiry; ≤1 PENDING
     per `(projectId, inviteeEmail)`; idempotent revoke on terminals).
  3. Membership uniqueness (Q1=X) — at most one *active* `(userId, projectId)`.
  4. Audit timestamp invariants — `updatedAt ≥ createdAt`, immutability of `createdAt`/`createdBy`,
     `updatedAt` doesn't move on no-op updates.
  5. Token round-trip and idempotent consume.
- Example-based tests pin canonical scenarios (PBT-10).

### Q-2 Strict typing & validation
- TypeScript strict; DTOs validated via `class-validator`; whitelist + forbidNonWhitelisted strips
  audit fields and unknown properties from incoming payloads.

## Audit-Stamping Pattern (Q2=B) — explicit contract

The user chose a **NestJS interceptor at the controller layer** rather than a TypeORM
`EntitySubscriber`. This is workable, with the following explicit contract:

### A-1 HTTP-originated mutations
- A `AuditStampInterceptor` runs after the global `JwtAuthGuard` and after the `ValidationPipe`.
- For request handlers annotated `@StampAuditOnRequest()` (or equivalent metadata), the interceptor
  injects `createdAt`, `updatedAt`, `createdBy`, `updatedBy` onto the entity payload (or response
  shape, depending on direction) using the actor user id from the AsyncLocalStorage `RequestContext`.
- Insert vs update is determined by whether the entity carries an `id`/PK at the interceptor stage.

### A-2 System-originated mutations (gap remediation)
- Demo seed (BL-10) and the expiry transition path (BL-8 lazy) and any future scheduled jobs do
  **not** pass through controllers; they MUST explicitly set audit fields.
- Pattern: a small helper `stampSystem(entity)` populates `createdBy`/`updatedBy = null` and current
  timestamps. BR-X2 already permits `null` for system actor.

### A-3 Why the gap is acceptable
- The interceptor approach keeps audit logic out of repositories and is unit-testable in isolation.
- The system-stamping helper is small, explicit, and matches BR-X2's `null` allowance.
- Detailed audit (`audit_log` rows on transitions) is independent and uses Q8=A's explicit
  `AuditService.record(...)`, which works the same way regardless of whether the call originated in
  a controller or a system job.

### A-4 PBT properties for stamping
- For the stamping helper / interceptor: any payload after stamping has `updatedAt ≥ createdAt`;
  insert sets both equal; update only modifies `updatedAt` (and `updatedBy`); fields supplied by the
  caller are ignored (whitelist behavior). These complement the entity-level invariants.

## RequestContext Pattern (Q6=A)

### C-1 AsyncLocalStorage `RequestContext`
- Backed by Node `async_hooks.AsyncLocalStorage<RequestContext>`.
- Wrapped by `RequestContextService` (Nest `@Injectable()`), populated by a `RequestContextMiddleware`
  early in the pipeline:
  - `requestId: string` (UUID v4, assigned if not present)
  - `actorUserId: string | null` (set by `JwtAuthGuard` after token verification)
  - `ip: string`
  - `userAgent: string | null`
  - `route: string`
  - `now: () => Date` (default `new Date`, mockable in tests)
- Consumed by: `AuditStampInterceptor`, `AuditService`, `Logger`, throttler key extractor (when an
  authenticated user id is preferred over IP).

## Tech Stack Extension (delta vs `tech-stack-decisions.md`)

Q1=B introduces a new runtime dependency. NFR Requirements remains accurate at the library level
(`@nestjs/throttler`); this NFR Design extends the stack as follows (also reflected in
`logical-components.md`):

| Concern | Choice |
|---|---|
| Throttler storage | Redis 7 (Docker Compose service `redis`) |
| Redis client | **ioredis** |
| Throttler storage adapter | **Custom `RedisStorageService`** (implements `@nestjs/throttler` v4's `ThrottlerStorage` directly). The published `nestjs-throttler-storage-redis` package targets throttler v5+; see Unit 1 deployment notes. |

`.env.example` additions: `REDIS_HOST=localhost`, `REDIS_PORT=6379`, `REDIS_PASSWORD=` (optional),
`THROTTLE_REDIS_PREFIX=gbci:throttle:`.

`docker-compose.yml` gains a `redis:7-alpine` service plus a healthcheck; the backend depends on it.

## Compliance Summary (this stage)

- **PBT-01**: COMPLIANT — properties identified in Functional Design, restated in Q-1.
- **PBT-09**: COMPLIANT — `fast-check` confirmed in `tech-stack-decisions.md`.
- **PBT-02..08, PBT-10**: applicable at Code Generation / Build & Test, not at this stage.
- **Security baseline**: not enforced (extension OFF).
- **Resiliency baseline**: not enforced (extension OFF).

No blocking findings.
