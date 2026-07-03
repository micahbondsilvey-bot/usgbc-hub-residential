# Unit 1 — NFR Requirements

Unit-1-specific non-functional requirements. Globally pinned NFRs (NestJS/Angular/Postgres/local-only/
PBT full enforcement; security & resiliency baselines OFF) apply too — referenced by ID where relevant.

## Scalability

### NFR-U1-1.1 Local single-user / small-team scale
- Target: a single backend instance, single Postgres, ≤ 25 concurrent users for demos.
- No horizontal scaling, no caching layer, no autoscaling this build (security & resiliency
  baselines OFF; cloud is out of scope per Q7=A in Requirements Analysis).

### NFR-U1-1.2 Connection pool (Q7=A)
- Postgres pool size: **10**, idle timeout **30s**, startup retry **3×** with **3s** backoff,
  connect timeout **10s** (matches prototype).

## Performance (Q6=A)

### NFR-U1-2.1 Latency targets (single-user, local)
- `POST /api/v1/auth/login` p95 **≤ 300 ms**.
- `GET /api/v1/auth/me`, `GET /api/v1/users/me` p95 **≤ 100 ms**.
- `POST /api/v1/projects/:id/invitations` (create) p95 **≤ 200 ms**.
- `POST /api/v1/invitations/accept` p95 **≤ 300 ms**.
- `GET /api/v1/projects/:id/me-role` p95 **≤ 100 ms**.

### NFR-U1-2.2 Bcrypt cost
- Cost factor **10** (per Functional Design BR-A2). At cost 10 a single hash is ~60–80 ms on
  modern hardware, which fits the login p95 budget while preserving brute-force resistance.

## Availability

### NFR-U1-3.1 Demo-grade availability
- Target: best-effort during local demos. Health endpoint at `GET /health` already exists (public).
- Docker Compose orchestrates Postgres; the app waits for the DB on startup (existing retry pattern).
- No SLAs, no failover, no replicas this build.

## Security (baseline extension OFF; foundation security retained)

### NFR-U1-4.1 Access tokens (Q1=A)
- Algorithm: **HS256**. Secret from `LOCAL_JWT_SECRET`.
- TTL: **8h** (matches prototype `LOCAL_JWT_EXPIRES_IN`).
- Issuer: `usgbc-hub-residential-be`.
- No refresh tokens this build; user re-authenticates after expiry.

### NFR-U1-4.2 One-time token TTLs (Q2=A)
- Password reset: **1 hour**.
- Email verification: **7 days**.
- Invitation: **7 days**.
- All one-time tokens are stored as a hash; the cleartext token is delivered only via the (mocked)
  notification channel and never persisted.

### NFR-U1-4.3 Auth endpoint rate-limiting (Q3=A)
- Per-IP throttle on:
  - `POST /api/v1/auth/login` — **10/min**, **30/hour**.
  - `POST /api/v1/auth/password/reset/request` — **5/min**, **20/hour**.
  - `POST /api/v1/invitations/accept` — **10/min**, **30/hour**.
- Library: NestJS `@nestjs/throttler` (TTL/limit configured per route).
- Trust proxy header: not applicable for local; configurable for future deployments.

### NFR-U1-4.4 Frontend token storage (Q4=B)
- Access token persisted in **`sessionStorage`** for the tab session.
- Cleared on logout, on `401` interceptor response, and naturally on tab close.
- Stored under a single key (`gbci.accessToken`); read/written by `AuthService` only.
- Documented trade-off vs in-memory: better demo UX (survives navigation) at the cost of broader
  XSS exposure than in-memory; acceptable for local demos and noted as a future hardening item.

### NFR-U1-4.5 Generic-error semantics
- Login, password-reset, and invite-token failures use generic responses (BR-A1/BR-A3/BR-E4).
- The auth response never reveals whether email or password was wrong.

### NFR-U1-4.6 Defaults retained from prototype
- `helmet()` security headers (relaxed only for `local` env).
- CORS restricted to `FRONTEND_ORIGIN`.
- Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform`.

## Reliability

### NFR-U1-5.1 Error handling
- All HTTP errors flow through the existing `AllExceptionsFilter`. Validation errors → 400; auth → 401;
  authz → 403; not found → 404; gone (terminal-state invite) → 410; conflict (membership/uniqueness)
  → 409; server → 500. No raw stack traces leak to clients.

### NFR-U1-5.2 Audit-log growth (Q8=A)
- No retention policy this build. Local-only, demo dataset; growth is bounded by use.
- Documented as a future concern: pruning / archival job and/or partition-by-month strategy when
  the system moves to non-local environments.

### NFR-U1-5.3 Idempotent operations
- Demo seed (BL-10), invite revoke on terminal states (BR-I2), token consumption (BL-7).

## Maintainability

### NFR-U1-6.1 Quality gates (this unit)
- ESLint + Prettier clean (single quotes, 100-col).
- TypeScript strict mode (no implicit `any`, exact optional property types).
- Code structured by NestJS module boundaries (`auth/`, `users/`, `membership/`, `audit/` under
  `usgbc-hub-residential-be/src/`); restructure existing `auth/` and `users/` in place per Units
  Generation Q8=A.
- Swagger annotations on all endpoints; DTOs validated with `class-validator`.

### NFR-U1-6.2 Property-Based Testing (Q9=A)
- Framework: **fast-check** (backend Jest) — confirmed via `tech-stack-decisions.md` (PBT-09).
- ≥ **100 runs per property** by default.
- **CI**: deterministic seed via `FAST_CHECK_SEED` env var.
- **Local**: random seed; the seed is logged on every PBT run for reproducibility.
- Properties under test (PBT-01 carry-over from Functional Design): authorization decision function,
  invitation state machine, membership uniqueness, audit timestamp invariants, token round-trip /
  idempotence.
- **Complementary** example-based tests for canonical scenarios (PBT-10).
- All PBT included in CI; flaky failures investigated, not silenced (PBT-08).

### NFR-U1-6.3 Logging & PII (Q5=A)
- Reuse the existing `Logger` and `mask.util` (already secret-aware).
- For auth/invite events, log: `event`, `actorUserId`, `outcome`, masked email, request id (when
  available); never log password, password hash, or cleartext tokens.

## Usability / Accessibility (Q10=A)

### NFR-U1-7.1 Accessibility — Unit 1 frontend
- WCAG 2.1 AA-aligned for the auth, profile, and invite-accept screens:
  - Full keyboard navigability and a visible focus indicator.
  - Form fields use `mat-label` (or `aria-label`/`aria-labelledby`) with explicit input/label association.
  - Error messages exposed via `aria-describedby`; `aria-live` for async error feedback.
  - Color-contrast pass on the default light theme; theming preserves contrast ratios in dark mode.
- Note: full WCAG validation requires manual testing with assistive tech and accessibility expert
  review; this NFR commits to compliant component patterns, not a formal certification.

## Compliance & Privacy
- No regulated-data handling in this unit (no payment, no PHI, no PII beyond email/name/organization
  and the Green Rater credential ID).
- Cleartext tokens are never persisted (BR-A3, BR-A4, BR-I).

## Open Items (deferred)
- Refresh tokens / sliding sessions (Q1=A pinned to 8h single-issue).
- Audit-log retention policy.
- Rate-limit configuration when behind a real proxy/load balancer.
- HTTP-only cookie auth (instead of `sessionStorage`) when the platform leaves local-only.
