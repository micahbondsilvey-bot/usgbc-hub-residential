# Unit 1 — Tech Stack Decisions

Records the concrete library/configuration choices for Unit 1 and the rationale, plus the
**PBT-09 framework selection** required by the Property-Based Testing extension.

## Backend (`usgbc-hub-residential-be`)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js **20.13.1** (existing) | Pinned via `package.json` engines |
| Framework | **NestJS 9.x** (existing) | Modular structure, decorators-driven |
| Language | **TypeScript** strict | `strict`, `noImplicitAny`, exact optional property types |
| ORM / DB driver | **TypeORM 0.3.x + pg 8.x** (existing) | Single Postgres |
| Database | **PostgreSQL** (Docker Compose) | Local-only |
| Schema management | `synchronize=true` for local | Migrations are a future concern (NFR-6) |
| Password hashing | **bcryptjs**, cost **10** | Matches prototype |
| JWT | **jsonwebtoken** HS256, 8h, issuer `usgbc-hub-residential-be` | Q1=A |
| Validation | **class-validator + class-transformer** | Existing `ValidationPipe` config |
| Security headers | **helmet** | Existing |
| API docs | **@nestjs/swagger** at `/api-docs` | API base `/api/v1` per Application Design Q5=A |
| Rate-limiting | **@nestjs/throttler** v4 (paired with our own `RedisStorageService`) | Per-route limits via `@Throttle(limit, ttl)`. We implemented `ThrottlerStorage` directly using `ioredis`; no third-party storage adapter needed. |
| Logging | Existing `Logger` + `mask.util` | Reuse with masking (Q5=A) |
| Exception filter | Existing `AllExceptionsFilter` | Maps domain errors to HTTP codes |
| Random tokens | `crypto.randomBytes(32)` URL-safe | Cleartext never persisted |
| Audit subscriber | Custom TypeORM EntitySubscriber | Stamps `createdAt/updatedAt/createdBy/updatedBy` |
| Test runner | **Jest 29** (existing) + ts-jest | CI-style: `npm test` runs unit + PBT |
| **PBT framework (PBT-09)** | **fast-check** (latest stable, ≥ 3.x) | Custom generators for domain types; supports shrinking, seeded reproducibility, integrates with Jest |

### PBT-09 Compliance — Backend
- Selected: `fast-check`.
- Supports custom generators (Arbitraries) for domain types: `User`, `ProjectMembership`,
  `Invitation`, `AuthInput` — defined as reusable test utilities under `src/<unit>/__tests__/arb/`.
- Supports automatic shrinking (default; not disabled).
- Supports seed-based reproducibility (CLI / `fc.configureGlobal`); seed logged on every run.
- Integrates with Jest via standard test runner; included in `npm test`.

## Frontend (`usgbc-hub-residential-fe`)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Angular 20.2** (standalone components) | Pinned to 20.2 because Angular 21 CLI requires Node ≥ 20.19. Move to Angular 21 when the team adopts a Node ≥ 20.19 baseline. |
| Node runtime | **Node 20.19.0** (FE folder only) | Pinned via `usgbc-hub-residential-fe/.nvmrc`; backend keeps Node 20.13.1. |
| State | **Angular Signals** | `signal`, `computed`, `toSignal` |
| UI library | **Angular Material 20.2 + CDK** | Theme tokens via `--usgbc-*` SCSS custom properties |
| Routing | Lazy-loaded standalone routes | Auth + profile + invite-accept under `features/auth/` |
| HTTP | `HttpClient` with `authInterceptor` + `errorInterceptor` | Bearer attached; 401 → /login |
| Token storage | **`sessionStorage`** key `gbci.accessToken` (Q4=B) | Cleared on logout/401/tab-close |
| Forms | Reactive forms + Material `mat-form-field` | Validators incl. min-length 8, equal-to-control |
| **PBT framework (PBT-09)** | **fast-check** (declared dependency) | Same library cross-stack; integrates with Vitest when tests are added |
| Lint/format | ESLint + Prettier (single quotes, 100-col) | Shared rules with backend where applicable |
| TypeScript | **5.8.x** strict | Compatible with Angular 20.2 |
| Accessibility | WCAG 2.1 AA-aligned patterns (Q10=A) | Material + ARIA usage, contrast pass |

### PBT-09 Compliance — Frontend
- Selected: `fast-check`.
- Targets in this unit: pure form validators (e.g., `equalToControl`), the FE-side authorization
  view-helpers (mirrors of BR-Z2 for showing/hiding actions only — server is authoritative), and
  any pure utilities shared between front- and back-end.
- Shrinking enabled, seed logged on every run.

## Configuration / Environment (Unit 1)

Environment variable additions for this unit (extend existing `.env`):

```
# Auth tokens
LOCAL_JWT_SECRET=<set-in-.env>
LOCAL_JWT_EXPIRES_IN=8h            # NFR-U1-4.1
PASSWORD_RESET_TTL=1h              # NFR-U1-4.2
EMAIL_VERIFICATION_TTL=7d          # NFR-U1-4.2
INVITATION_TTL=7d                  # NFR-U1-4.2

# Throttling
THROTTLE_LOGIN_PER_MIN=10
THROTTLE_LOGIN_PER_HR=30
THROTTLE_RESET_PER_MIN=5
THROTTLE_RESET_PER_HR=20
THROTTLE_INVITE_ACCEPT_PER_MIN=10
THROTTLE_INVITE_ACCEPT_PER_HR=30

# DB pool
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT_MS=30000

# Demo seed
SEED_USERS=admin@residential.test|Admin123!|admin;team@residential.test|Team123!|user;rater@residential.test|Rater123!|user;reviewer@residential.test|Reviewer123!|user

# PBT
FAST_CHECK_RUNS=100                # ≥100 runs per property (NFR-U1-6.2)
# FAST_CHECK_SEED=<set-in-CI>      # deterministic seed in CI; absent locally → random + logged
```

(Existing `.env`/`.env.example` keys for `APP_PORT`, `DB_*`, `FRONTEND_ORIGIN`, `MOCK_AUTH*` are
retained as-is and reused.)

## Rationale Summary
- Reuse the prototype's stack and configuration where it already aligns with our decisions; restructure
  in place per Units Generation Q8=A.
- Add only the libraries needed for new capabilities: `@nestjs/throttler` for rate-limiting,
  `fast-check` for PBT.
- Keep the cryptographic posture sober for a foundation: HS256 + bcrypt cost 10 + per-IP throttling
  is appropriate for a local demo; refresh tokens, asymmetric keys, and HTTP-only cookies are
  documented as deferred.
- Cross-stack `fast-check` minimizes cognitive load and keeps PBT idioms uniform between Jest and
  Vitest.

## PBT-09 Verification Checklist
- [x] PBT framework selected and documented (fast-check) — backend and frontend.
- [x] Framework supports custom generators, shrinking, seed-based reproducibility.
- [x] Framework included as project dependency (added to `package.json` during Code Generation).
- [x] Multi-language coverage: only TypeScript in this unit; one framework spans both ends.

**Stage compliance**: PBT-09 — COMPLIANT. PBT-01–08, PBT-10 — applicable but enforced at later
stages (Code Generation, Build & Test). No blocking findings.
