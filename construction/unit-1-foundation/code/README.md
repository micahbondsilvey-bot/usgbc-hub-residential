# Unit 1 — Code Summary

What was generated, where, and how to run it locally.

## Application code

### Backend (modified in place: `usgbc-hub-residential-be/`)

**Created**
- `src/common/request-context/{request-context.service.ts, request-context.middleware.ts, request-context.module.ts}`
- `src/common/tokens/{one-time-token.service.ts, tokens.module.ts}`
- `src/common/expiry/expiry.service.ts`
- `src/common/throttler/{throttler.module.ts, redis-storage.service.ts}`
- `src/common/notifications-stub/notification.gateway.ts`
- `src/audit/{audit-base.entity.ts, audit-log.entity.ts, audit.service.ts, audit-stamp.interceptor.ts, audit-stamp.helper.ts, stamp-audit-on-request.decorator.ts, audit.module.ts}`
- `src/auth/decorators/project-roles.decorator.ts`
- `src/auth/guards/project-roles.guard.ts`
- `src/auth/dto/{login.dto.ts, password-reset.dto.ts, verify-email.dto.ts}`
- `src/auth/password-reset/{password-reset-token.entity.ts, password-reset.service.ts}`
- `src/auth/email-verification/{email-verification-token.entity.ts, email-verification.service.ts}`
- `src/users/users.controller.ts`
- `src/users/dto/{profile.dto.ts, update-profile.dto.ts}`
- `src/membership/{project-membership.entity.ts, invitation.entity.ts, membership.service.ts, invitation.service.ts, invitations.controller.ts, dto/invitation.dto.ts, membership.module.ts}`

**Modified**
- `package.json` — added `@nestjs/throttler`, `@nestjs/throttler-storage-redis`, `ioredis`, `fast-check`; new `test:pbt` script.
- `docker-compose.yml` — added `redis:7-alpine` service with healthcheck.
- `.env`, `.env.example` — token TTLs, throttle limits, Redis vars, PBT runs/seed, hybrid-RBAC seed format.
- `src/config/configuration.ts` — loads/validates new env keys; legacy seed format accepted.
- `src/auth/enums/{role.enum.ts, permission.enum.ts}` — split into `GlobalRole` + `ProjectRole`; permission map keyed off project roles; legacy aliases retained.
- `src/auth/interfaces/auth-user.interface.ts` — carries `globalRole` only; project roles resolved per-request.
- `src/auth/local/local-auth.service.ts` — HS256 8h, no role in payload (BR-Z4).
- `src/auth/auth.service.ts` — login + resolveUser only.
- `src/auth/guards/jwt-auth.guard.ts` — populates `RequestContext.actorUserId`.
- `src/auth/auth.controller.ts` — fully rewritten; `/api/v1/auth/{login,me,logout,password/reset/{request,confirm},email/verify}`; `@Throttle` per-route.
- `src/auth/auth.module.ts` — registers new providers; `JwtAuthGuard` + `ThrottlerGuard` global.
- `src/users/{user.entity.ts, users.service.ts, users.module.ts}` — extended User; demo seed via `AuditStampHelper`; `UsersController` registered.
- `src/common/logger/mask.util.ts` — exported `maskString`.
- `src/app.module.ts` — registered new modules + entities; pool size 10/idle 30s.
- `src/main.ts` — global `/api/v1` prefix + URI versioning.

**Removed (legacy, no longer used)**
- `src/auth/dto/{create-user.dto.ts, update-role.dto.ts, profile.dto.ts}`
- `src/auth/guards/roles.guard.ts`
- `src/auth/decorators/roles.decorator.ts`

### Frontend (new app: `usgbc-hub-residential-fe/`)

Angular 21 standalone-component PWA scaffold (Vitest excluded per user direction):
- `package.json`, `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `.gitignore`, `.prettierrc`
- `src/{index.html, main.ts, styles.scss}`, `src/environments/environment.ts`
- `src/app/app.config.ts`, `src/app/app.component.ts`, `src/app/app.routes.ts`
- `src/app/core/api/{dto.ts, api-client.ts}`
- `src/app/core/auth/{auth.service.ts, auth.interceptor.ts, error.interceptor.ts, auth.guard.ts, project-role.guard.ts}`
- `src/app/features/auth/login/login.component.ts`
- `src/app/features/auth/profile/profile.component.ts`
- `src/app/features/auth/password-reset/{request-reset.component.ts, confirm-reset.component.ts, equal-to.validator.ts}`
- `src/app/features/auth/verify-email/verify-email.component.ts`
- `src/app/features/auth/invite-accept/invite-accept.component.ts`
- `src/app/features/auth/forbidden/forbidden.component.ts`

## How to run locally

### Prerequisites
- Node.js 20.13.1+
- Docker (for Postgres + Redis)

### One-time setup
```bash
# Backend
cd usgbc-hub-residential-be
cp .env.example .env   # if not already present
npm install
npm run db:up          # starts Postgres AND Redis (Docker)

# Frontend
cd ../usgbc-hub-residential-fe
npm install
```

### Run
```bash
# Terminal 1 — backend (binds :3000, Swagger at /api-docs)
cd usgbc-hub-residential-be
npm run start:dev

# Terminal 2 — frontend (binds :4200)
cd usgbc-hub-residential-fe
npm start
```

Open `http://localhost:4200` and sign in with one of the seeded demo accounts.

### Seeded demo accounts (from `.env`)

| Email | Password | Global role |
|---|---|---|
| `admin@residential.test` | `Admin123!` | admin |
| `team@residential.test` | `Team123!` | user |
| `rater@residential.test` | `Rater123!` | user |
| `reviewer@residential.test` | `Reviewer123!` | user |

Project memberships for `team`, `rater`, `reviewer` will be reconciled once
Unit 3 ships the demo project.

### Endpoints (Unit 1)

All routes are versioned under `/api/v1`. Swagger UI at `http://localhost:3000/api-docs`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | public | Email/password sign-in |
| GET | `/api/v1/auth/me` | bearer | Current profile |
| POST | `/api/v1/auth/logout` | public | No-op (client clears token) |
| POST | `/api/v1/auth/password/reset/request` | public | Request reset link (mocked email) |
| POST | `/api/v1/auth/password/reset/confirm` | public | Set new password using token |
| POST | `/api/v1/auth/email/verify` | public | Verify email using token |
| GET | `/api/v1/users/me` | bearer | Get profile |
| PUT | `/api/v1/users/me` | bearer | Update name / org / GR credential |
| POST | `/api/v1/projects/:projectId/invitations` | bearer + PT/GR/Admin | Invite a user to a project |
| GET | `/api/v1/projects/:projectId/members` | bearer + member/Admin | List active members |
| GET | `/api/v1/projects/:projectId/me-role` | bearer | Resolve caller's project role |
| DELETE | `/api/v1/projects/:projectId/invitations/:id` | bearer + inviter/Admin | Revoke a pending invite |
| GET | `/api/v1/invitations/preview?token=...` | public | Inspect invite without consuming |
| POST | `/api/v1/invitations/accept` | optional bearer | Accept invite (creates account when needed) |
| POST | `/api/v1/invitations/decline` | public | Decline invite |
| GET | `/health` | public | Liveness |

## Stories satisfied

| Story | Where it lands |
|---|---|
| US-1.1 Login | Backend `/auth/login` + FE `LoginComponent` |
| US-1.2 Manage profile | `/users/me` + `ProfileComponent` |
| US-1.3 Password reset / email verification | password-reset + email-verification services + FE pages |
| US-1.4 Demo seed | `UsersService.onModuleInit` |
| US-2.6 Invite users (membership half) | `MembershipService` + `InvitationService` + `InvitationsController` + FE `InviteAcceptComponent` |
| US-11.1 RBAC (four roles, hybrid) | `GlobalRole` + `ProjectRole` + `JwtAuthGuard` + `ProjectRolesGuard` + `MembershipService` |
| US-11.3 Audit trails & timestamps | `AuditBase` + `AuditService` + `AuditLog` + `AuditStampInterceptor`/`Helper` |

## PBT compliance summary (this build)

Per the active extension policy (full PBT enforcement):

| Rule | Status | Notes |
|---|---|---|
| PBT-01 Property identification | COMPLIANT | 5 properties identified in functional design |
| PBT-09 Framework selection | COMPLIANT | `fast-check` declared in both backend and frontend deps |
| PBT-02..08, PBT-10 | **NON-COMPLIANT (DOCUMENTED DEVIATION)** | Test cases skipped this build per user direction. Properties are designed in but not yet asserted; can be added without rework. |

The deviation is recorded in `aidlc-docs/audit.md` so it remains traceable.

## Out of scope this unit
- Backend tests (Jest) and frontend tests (Vitest) — skipped per user direction.
- Cron-based expiry sweeps (lazy expiry only, NFR Design Q3=A).
- Real notification delivery; the gateway is a logging stub (Q4=A).
- Project entity (Unit 3); FK columns on memberships and invitations are forward-declared.
