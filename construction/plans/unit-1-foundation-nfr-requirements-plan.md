# NFR Requirements Plan — Unit 1: Platform Foundation

**Already pinned by the global requirements** (no need to re-decide; included for traceability):
- NestJS (Node 20.13.1+), TypeScript strict, Angular 21 PWA, PostgreSQL, local-only Docker Compose,
  ESLint+Prettier, structured logging, Helmet, CORS to FE origin, DTO validation
  (whitelist + forbidNonWhitelisted), JWT auth, bcrypt password hashing.
- **PBT framework**: `fast-check` (backend Jest, frontend Vitest) — full enforcement.
- **Security baseline**: OFF. **Resiliency baseline**: OFF.
- **Demo posture**: pre-seeded data, mocked external delivery, zero-latency presentations.

This plan asks only the **Unit-1-specific** NFR choices that remain.

---

## Design Questions

Please answer each `[Answer]:` tag.

### Question 1 — Access token strategy
The prototype issues an HS256 JWT with no refresh token. For this build:

A) Keep HS256 + a single access token, TTL 8h (matches prototype `LOCAL_JWT_EXPIRES_IN=8h`); recommended for foundation/demo

B) HS256 access token (short-lived, e.g., 15m) + refresh token (e.g., 7d, opaque, persisted)

C) Switch to RS256 now (asymmetric keys)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Token TTLs (other tokens)
Default time-to-live for one-time tokens used in this unit. Choose a profile or override:

A) Password reset = 1 hour; Email verification = 7 days; Invitation = 7 days; recommended

B) Tighter — Password reset = 30 min; Email verification = 24 hours; Invitation = 3 days

C) Looser — Password reset = 24 hours; Email verification = 30 days; Invitation = 30 days

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Authentication endpoint rate-limiting
Even with the security baseline OFF, basic abuse protection on login / password-reset is cheap and
prudent.

A) Apply per-IP rate limits to `POST /auth/login`, `POST /auth/password/reset/request`, and `POST /invitations/accept` (e.g., 10 req/min per IP, 30 req/hour); recommended

B) No rate-limiting in this build (matches prototype today)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Token storage on the frontend
Where should the access token live in the Angular PWA?

A) In-memory only (Signal); cleared on refresh — most secure but requires re-login on tab refresh

B) `sessionStorage` — persists for the tab session (recommended for demo: survives navigation, dies with the tab)

C) `localStorage` — persists across tabs/sessions (most convenient for demos but broadest XSS exposure)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 5 — Logging & PII for auth events
The prototype already has a structured logger with secret masking. For this unit:

A) Reuse the existing logger; mask emails/passwords/tokens in logs; log `event` + `userId` + outcome on auth/invite events; recommended

B) Plus emit a separate JSON `auth-events.log` line per login attempt (success/failure + masked email)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Performance / throughput targets (local demo)
This is local-only; what's the bar?

A) Demo bar — single-user latency goals: login p95 ≤ 300ms; profile/me p95 ≤ 100ms; invite create p95 ≤ 200ms; recommended

B) Stricter — login p95 ≤ 150ms; profile/me p95 ≤ 50ms

C) No formal target — best-effort

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Database connection / pooling
For the single local Postgres:

A) Connection pool size 10, idle timeout 30s, retry 3× on startup (matches prototype connect timeout 10s); recommended

B) Larger pool (25) for heavier local concurrency

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Audit-log growth / retention
We're writing an append-only `audit_log`. For local demo:

A) No retention policy this build; documented as a future concern; recommended

B) Cap with periodic pruning of rows older than 90 days

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 9 — PBT execution & seed handling
Confirm the PBT runtime posture (NFR-4.4 already says "seed logging for reproducibility"):

A) `fast-check` with deterministic CI seed in CI (env var `FAST_CHECK_SEED`); on local runs, log the seed on every PBT run; ≥100 runs per property by default; recommended

B) Random seed every run (CI + local), always logged; ≥100 runs

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 10 — Accessibility bar (frontend foundation)
The PWA frontend uses Angular Material. For Unit 1's auth/profile/invite-accept screens:

A) WCAG 2.1 AA-aligned components: keyboard navigability, visible focus, accurate labels and `aria-*`, color-contrast pass on default theme; recommended (NFR-7.2 alignment)

B) Defer accessibility considerations to a later cycle

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Execution Checklist (runs after answers)

- [x] Step A: Generate `aidlc-docs/construction/unit-1-foundation/nfr-requirements/nfr-requirements.md` capturing scalability/performance/availability/security/reliability/maintainability/usability requirements specific to Unit 1.
- [x] Step B: Generate `aidlc-docs/construction/unit-1-foundation/nfr-requirements/tech-stack-decisions.md` recording the Unit 1 stack decisions (libraries, PBT framework selection per **PBT-09**, configurations, and rationale).
- [x] Step C: Validate that PBT-09 (framework selection) is satisfied for this unit.
