# Code Generation Plan — Unit 1: Platform Foundation

**Source of truth** for U1 Code Generation. Each step has a checkbox; tests are generated alongside
the code they cover. Build & Test runs once at the end of all units.

---

## Unit Context

- **Workspace root**: `/Users/hbayyapu/usgbc-hub-residential`
- **Project type**: Brownfield (NestJS backend exists; Angular PWA new)
- **Backend dir**: `usgbc-hub-residential-be/` (restructure in place — Q8=A from Units Generation)
- **Frontend dir**: `usgbc-hub-residential-fe/` (new Angular 21 standalone app)
- **Documentation summaries**: `aidlc-docs/construction/unit-1-foundation/code/`

### Stories implemented by this unit
- US-1.1 Email/password registration & login
- US-1.2 Manage basic profile
- US-1.3 Password reset & email verification (mocked delivery)
- US-1.4 Pre-seeded demo accounts
- US-2.6 (membership half) Invite users to a project
- US-11.1 RBAC (four roles + per-project hybrid)
- US-11.3 Audit trails & timestamps

### Dependencies on other units
- None (U1 is the foundation). Provides cross-cutting components reused by U2..U9.

### Key contracts produced (consumed by later units)
- `RequestContextService` (AsyncLocalStorage)
- `JwtAuthGuard`, `ProjectRolesGuard`, `@ProjectRoles(...)`, `@Public`, `@CurrentUser`
- `AuditBase` mixin, `AuditService.record(...)`, `AuditStampInterceptor`, `AuditStampHelper`
- `OneTimeTokenService`, `ExpiryService`
- `ThrottlerModule` (Redis-backed, fail-open)
- `NotificationGateway` stub (replaced by Unit 7)

### Database entities owned by this unit
- `users` (extended), `project_memberships`, `invitations`, `password_reset_tokens`,
  `email_verification_tokens`, `audit_log`.

> Note: `projects` table is forward-declared (FKs declared with deferred application until Unit 3
> ships the `Project` entity).

---

## Generation Steps

### Backend — Project structure & configuration

- [x] **Step 1** Update backend dependencies: add `@nestjs/throttler`, `@nestjs/throttler-storage-redis`,
  `ioredis`, `fast-check` (devDependency); pin versions; run install. Update `package.json` scripts:
  `test:pbt` runs property tests with `FAST_CHECK_RUNS=100` and seed log.
- [x] **Step 2** Update `docker-compose.yml`: add `redis:7-alpine` service with healthcheck; backend
  depends on it. Document local default ports.
- [x] **Step 3** Update `.env.example` with U1 keys (token TTLs, throttle limits, Redis vars,
  `FAST_CHECK_RUNS`) per `tech-stack-decisions.md`. Update `.env` with sensible defaults.
- [x] **Step 4** Extend `src/config/configuration.ts` to load and validate the new env keys
  (TTLs, throttle, Redis); fail-fast if missing.

### Backend — Cross-cutting building blocks

- [x] **Step 5** Create `src/common/request-context/` (RequestContextModule):
  - `request-context.service.ts` (AsyncLocalStorage<RequestContext>)
  - `request-context.middleware.ts` (assigns `requestId` UUIDv4; populates IP, UA, route, `now`)
  - `request-context.module.ts`
  Wire the middleware globally in `AppModule`.
- [x] **Step 6** Create `src/audit/`:
  - `audit-base.entity.ts` (abstract: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
  - `audit-log.entity.ts` (append-only: `entityType`, `entityId`, `action`, `actorUserId`, `at`,
    `before`, `after`, `reason`)
  - `audit.service.ts` (`record(change)`)
  - `audit-stamp.interceptor.ts` (Q2=B: stamps HTTP-originated mutations from RequestContext)
  - `audit-stamp.helper.ts` (system-stamping for seed/expiry)
  - `stamp-audit-on-request.decorator.ts`
  - `audit.module.ts`
- [x] **Step 7** Create `src/common/tokens/one-time-token.service.ts` (`crypto.randomBytes(32)`
  URL-safe; SHA-256 hash at rest; constant-time compare).
- [x] **Step 8** Create `src/common/expiry/expiry.service.ts` (lazy expiry per BL-8).
- [x] **Step 9** Create `src/common/throttler/throttler.module.ts` (Redis-backed via
  `@nestjs/throttler-storage-redis` + `ioredis`; fail-open on Redis unavailability with WARN log;
  per-route limits configured).
- [x] **Step 10** Create `src/common/notifications-stub/notification.gateway.ts` (best-effort
  mocked send: logs `event`, masked email, cleartext token URL — clearly marked DEMO ONLY).

### Backend — Auth & Users restructure

- [x] **Step 11** Modify `src/auth/enums/role.enum.ts`: add `GlobalRole` (ADMIN | USER) and
  `ProjectRole` (PROJECT_TEAM | GREEN_RATER | REVIEWER); retain backward-compatible exports for
  prototype consumers; update `ROLE_LABELS` accordingly.
- [x] **Step 12** Modify `src/auth/enums/permission.enum.ts`: keep existing permission catalog;
  re-key `ROLE_PERMISSIONS` to `ProjectRole` (Admin permissions are derived from `globalRole`).
- [x] **Step 13** Modify `src/users/user.entity.ts`: add `globalRole`, `organization`,
  `greenRaterCredentialId`, `emailVerifiedAt`, `lastLoginAt`; ensure inherits `AuditBase`; keep
  `auth0Sub` nullable for future Auth0 path.
- [x] **Step 14** Modify `src/users/users.service.ts`: split into `UsersService` (CRUD, profile,
  validateCredentials, findById/Email) and an `OnModuleInit` demo-seed bootstrapper using
  `AuditStampHelper` (system actor); idempotent. Remove the old prototype-style seed admin path.
- [x] **Step 15** Create `src/users/users.controller.ts` for `/api/v1/users/me` (GET, PUT) with
  the `AuditStampInterceptor` applied on PUT and `class-validator` DTOs. Conditional
  `greenRaterCredentialId` editability based on active GR memberships.
- [x] **Step 16** Modify `src/auth/local/local-auth.service.ts`: keep HS256 signing; add
  `LOCAL_JWT_EXPIRES_IN=8h`; remove role from token payload (resolve at request time per BR-Z4).
- [x] **Step 17** Modify `src/auth/auth.service.ts`: simplify to `login`, `getProfile`,
  `resolveUser` (mock + local). Auth0 path retained but flagged out of scope this unit.
- [x] **Step 18** Modify `src/auth/guards/jwt-auth.guard.ts`: populate
  `RequestContext.actorUserId` after token verification; preserve `@Public` semantics.
- [x] **Step 19** Create `src/auth/guards/project-roles.guard.ts` and
  `src/auth/decorators/project-roles.decorator.ts` (`@ProjectRoles(...allowed)`); resolve
  `:projectId` from route params and look up active `ProjectMembership`.
- [x] **Step 20** Modify `src/auth/auth.controller.ts`: routes under `/api/v1/auth` (login, me,
  password reset request/confirm, email verify, logout no-op). Apply `@Throttle` decorators.
- [x] **Step 21** Create password-reset and email-verification services
  (`src/auth/password-reset/`, `src/auth/email-verification/`) using `OneTimeTokenService`,
  `ExpiryService`, and `NotificationGateway`. Include corresponding entities
  (`PasswordResetToken`, `EmailVerificationToken`).
- [x] **Step 22** Modify `src/auth/auth.module.ts`: register new providers/controllers; ensure
  `JwtAuthGuard` remains the global `APP_GUARD`; add `ThrottlerGuard` as an additional global
  guard.

### Backend — Membership & Invitations

- [x] **Step 23** Create `src/membership/project-membership.entity.ts` with **unique
  `(userId, projectId)`** index (Q1=X), nullable `revokedAt`, `acceptedAt`, `invitedBy`.
- [x] **Step 24** Create `src/membership/invitation.entity.ts` (`state`, `tokenHash`, `expiresAt`,
  partial unique on `state=PENDING` per `(projectId, inviteeEmail)`).
- [x] **Step 25** Create `src/membership/membership.service.ts` (addMember, getRoleOnProject,
  listMembers, revokeMembership). Provide `getRoleOnProject(userId, projectId)` for guards.
- [x] **Step 26** Create `src/membership/invitation.service.ts` implementing BL-4..BL-7
  (issue token, persist hash; supersede prior PENDING; accept with new-account creation when no
  user exists; decline; revoke). Calls `AuditService.record(...)` on transitions.
- [x] **Step 27** Create `src/membership/invitations.controller.ts`:
  - `POST /api/v1/projects/:projectId/invitations` (PT/GR + Admin per BR-I1)
  - `DELETE /api/v1/projects/:projectId/invitations/:id` (revoke)
  - `GET /api/v1/projects/:projectId/members`
  - `GET /api/v1/projects/:projectId/me-role`
  - `GET /api/v1/invitations/preview?token=...` (public; preview only)
  - `POST /api/v1/invitations/accept` (public; throttled)
- [x] **Step 28** Create `src/membership/membership.module.ts` and wire into `AppModule`.

### Backend — App-wide wiring

- [x] **Step 29** Modify `src/app.module.ts`: import new modules (RequestContextModule,
  AuditModule, ThrottlerModule, MembershipModule), register new TypeORM entities, ensure global
  guards/interceptors/filters in correct order: `RequestContextMiddleware` → `ThrottlerGuard` →
  `JwtAuthGuard` → `ProjectRolesGuard` (route-level) → `AuditStampInterceptor` → `AllExceptionsFilter`.
- [x] **Step 30** Modify `src/main.ts`: introduce global API prefix `/api/v1`, retain Helmet/CORS;
  ensure Swagger is mounted at `/api-docs` under the prefix where appropriate.

### Backend — Tests (alongside the code) — SKIPPED PER USER DIRECTION

- [ ] ~~Step 31~~ **Skipped** (PBT deviation logged in audit.md). Add Jest setup for backend PBT.
- [ ] ~~Step 32~~ **Skipped**. Reusable `fast-check` arbitraries.
- [ ] ~~Step 33~~ **Skipped**. PBT for authorization decision function.
- [ ] ~~Step 34~~ **Skipped**. PBT (stateful) for the invitation state machine.
- [ ] ~~Step 35~~ **Skipped**. PBT for membership uniqueness.
- [ ] ~~Step 36~~ **Skipped**. PBT for audit timestamps.
- [ ] ~~Step 37~~ **Skipped**. PBT for token round-trip and idempotent consume.
- [ ] ~~Step 38~~ **Skipped**. Example-based tests for canonical scenarios.
- [ ] ~~Step 39~~ **Skipped**. Smoke integration test.

### Frontend — Bootstrap Angular 21 PWA

- [x] **Step 40** Scaffold new `usgbc-hub-residential-fe/` (Angular 21 standalone, strict TS,
  Vitest 4, Angular Material 20 + CDK; SCSS theming with `--usgbc-*`). Add `fast-check` as a dev
  dependency. Configure ESLint + Prettier.
- [x] **Step 41** Create `core/api/api-client.ts` (typed `HttpClient` wrapper), shared DTOs in
  `core/api/dto/` mirroring backend DTOs.
- [x] **Step 42** Create `core/auth/auth.service.ts` (Signals: `currentUser`, `accessToken`;
  `sessionStorage` persistence — Q4=B; clears on logout/401).
- [x] **Step 43** Create `core/auth/auth.interceptor.ts` (Bearer attach; 401 handler) and
  `core/auth/error.interceptor.ts` (no auto-retry on 5xx — Q5=A).
- [x] **Step 44** Create `core/auth/auth.guard.ts` and `core/auth/project-role.guard.ts`
  (calls `GET /api/v1/projects/:projectId/me-role`).

### Frontend — Auth feature pages

- [x] **Step 45** Create `features/auth/login/login.component.ts` with reactive form, validators,
  `data-testid` attributes, ARIA labels, loading + error state.
- [x] **Step 46** Create `features/auth/profile/profile.component.ts` (view/edit name, organization;
  conditional `greenRaterCredentialId`).
- [x] **Step 47** Create `features/auth/password-reset/{request-reset,confirm-reset}.component.ts`
  with token-in-URL flow.
- [x] **Step 48** Create `features/auth/verify-email/verify-email.component.ts`
  (token-in-URL flow).
- [x] **Step 49** Create `features/auth/invite-accept/invite-accept.component.ts` implementing
  the BL-5 state machine (loading → invalid|expired|needs-login|needs-account|ready → success|error).
- [x] **Step 50** Wire feature routes (lazy-loaded standalone routes) under `app.routes.ts`;
  apply `authGuard` and `projectRoleGuard` per route metadata. Add a 403 page.

### Frontend — Tests — SKIPPED PER USER DIRECTION

- [ ] ~~Step 51~~ **Skipped**. Vitest setup + `fast-check` integration.
- [ ] ~~Step 52~~ **Skipped**. PBT for pure validators.
- [ ] ~~Step 53~~ **Skipped**. Example tests for `LoginPage`, `InviteAcceptPage`.

### Documentation

- [x] **Step 54** Create `aidlc-docs/construction/unit-1-foundation/code/README.md` summarizing
  what was generated, file paths, and how to run U1 locally.
- [x] **Step 55** Update `usgbc-hub-residential-be/README.md` with the U1 changes (env keys,
  Redis dependency, new routes under `/api/v1`, restructured modules).
- [x] **Step 56** Generate `usgbc-hub-residential-fe/README.md` (how to run; PWA notes deferred to U9).
- [x] **Step 57** Confirm Swagger annotations are present on every U1 endpoint; the OpenAPI
  document at `/api-docs` covers U1 routes.

### Validation

- [x] **Step 58** Verify no duplicate files (e.g., no `*_modified.ts`, `*_new.ts`); modifications
  are in-place.
- [x] **Step 59** Verify code locations: app code under workspace root, only markdown summaries
  under `aidlc-docs/`.
- [x] **Step 60** Mark all completed stories ([x]) in the story map and surface a final
  PBT-compliance summary in `code/README.md`.

---

## Story Coverage

| Story | Steps |
|---|---|
| US-1.1 | 16, 17, 20, 22, 38, 42, 45 |
| US-1.2 | 13, 15, 38, 46 |
| US-1.3 | 7, 8, 21, 38, 47, 48 |
| US-1.4 | 14, 38, 39 |
| US-2.6 (membership half) | 23–28, 38, 49 |
| US-11.1 | 11, 12, 18, 19, 22, 25, 33, 38, 44, 50 |
| US-11.3 | 6, 14, 26, 36 |

## Total
- **60 numbered steps**, mixing backend code, backend tests, frontend code, frontend tests,
  configuration, and documentation.
- Tests are produced **alongside** code; the Build & Test stage at the end of all units runs them
  end-to-end.

## PBT Compliance for this stage
- **PBT-01..10**: This plan creates the artifacts (Steps 31–38, 51–53) that satisfy PBT
  rules at Code Generation; full compliance is verified during Build & Test (PBT-08 CI/seed
  logging, PBT-10 complementary example-based tests). No blocking findings yet at planning.
