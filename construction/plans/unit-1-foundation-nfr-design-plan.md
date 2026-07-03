# NFR Design Plan — Unit 1: Platform Foundation

**Purpose**: Translate Unit 1 NFRs into design patterns and logical components.

**Pinned by NFR Requirements** (no need to re-decide):
- HS256 8h access tokens, no refresh; bcrypt cost 10.
- One-time tokens stored as hashes; cleartext only via mocked notification.
- Per-IP rate limits on login / reset-request / invite-accept (`@nestjs/throttler`).
- Frontend access token in `sessionStorage`.
- Generic auth/authz error semantics; existing `AllExceptionsFilter`.
- Latency targets (NFR-U1-2.1); pool size 10; helmet/CORS/ValidationPipe retained.
- PBT framework: `fast-check`; ≥100 runs; CI deterministic seed; local seed logged.
- WCAG 2.1 AA-aligned components for auth/profile/invite-accept screens.
- **Security baseline OFF, Resiliency baseline OFF** → no AWS-specific hardening, no formal
  retry/circuit-breaker patterns required.

This plan asks the small set of remaining pattern decisions for Unit 1.

---

## Design Questions

Please answer each `[Answer]:` tag.

### Question 1 — Throttler storage backend
`@nestjs/throttler` needs a counter store. For a single-instance local backend:

A) In-memory store (per-process) — simplest, sufficient for a single-instance demo (recommended)

B) Redis-backed (mirrors target architecture)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 2 — Audit-stamping mechanism
How should `createdAt/updatedAt/createdBy/updatedBy` be auto-populated?

A) TypeORM `EntitySubscriber` registered globally; reads the actor user id from a `RequestContextService` (AsyncLocalStorage). Stripping audit fields from incoming DTOs is enforced by the `ValidationPipe` whitelist. Recommended — works without touching repositories.

B) NestJS interceptor at the controller layer that mutates entity payloads before service calls.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 3 — Expiry & system-tick policy
Invitation/password-reset/email-verification tokens have TTLs. How should we handle expiry?

A) Lazy on access — when the token is queried (preview/accept/use) the service compares `expiresAt` to `now` and transitions/handles state inline. No background scheduler this build (recommended for local/demo). Optional admin endpoint to run a tick on demand, useful in PBT/tests.

B) Background scheduler (e.g., NestJS `@Cron`) that periodically marks `EXPIRED`.

C) Both — lazy + background.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Notification (email) failure pattern for U1 sends
Unit 1 sends mocked emails (reset link, invite link, verification). The full notification framework
lives in Unit 7. For U1's behavior when the (mock) provider "fails":

A) Treat send as best-effort and log the failure; the calling operation succeeds (token persisted, invite created). The user can request a re-send. Recommended — simplest, matches mocked-delivery posture.

B) Roll back the operation on send failure (transactional outbox).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Frontend resilience patterns for auth
For the Angular PWA's auth pages:

A) Standard interceptor patterns: attach Bearer; on `401` clear token + route to `/login` preserving `redirectTo`; on transient `5xx`, show a friendly retry prompt (no automatic exponential retry). Recommended.

B) Add an automatic exponential backoff retry on transient `5xx` (1 retry only).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — RequestContext propagation
The audit subscriber and rate-limiter need request-scoped context (actor user id, request id).

A) `AsyncLocalStorage` (Node `async_hooks`) wrapped by a `RequestContextService` populated by a NestJS middleware on each request. Recommended — no code-path threading.

B) Manual passing through service params.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Token entropy & hashing
For one-time tokens (reset/verify/invite):

A) `crypto.randomBytes(32)` URL-safe; persisted as **SHA-256** of cleartext (constant-time compare on lookup). Recommended — cheap, sufficient for one-time tokens (bcrypt is overkill here).

B) Persist as bcrypt hash of cleartext (slower verify, no real benefit for high-entropy tokens).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — `audit_log` write path
Some changes (e.g., status transitions) must produce an `audit_log` row in addition to entity-level
fields. How should writes be issued?

A) Domain services explicitly call `AuditService.record(...)` on transitions (recommended — explicit and traceable; avoids accidental fan-out of inserts).

B) Auto-derive `audit_log` rows from entity-update events on annotated columns.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (runs after answers)

- [x] Step A: Generate `aidlc-docs/construction/unit-1-foundation/nfr-design/nfr-design-patterns.md` covering security, resilience, performance, observability, and quality patterns adopted for Unit 1.
- [x] Step B: Generate `aidlc-docs/construction/unit-1-foundation/nfr-design/logical-components.md` enumerating the supporting components (RequestContext, AuditSubscriber, AuditService, Throttler, ExpiryService, RateLimit configuration, FE interceptors/guards) and how they fit together.
