# Unit 1 — Frontend Components (Angular 21 PWA)

Frontend slice for Unit 1: auth, profile, invite-accept (Q9=A), plus core interceptors and route
guards used by every other feature. Standalone components, Signals for state, lazy-loaded routes
(per Application Design Q6=A).

## Component Hierarchy

```
src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts                 (Signals: currentUser, accessToken)
│   │   ├── auth.interceptor.ts             (attaches Bearer token; 401 → redirect to /login)
│   │   ├── auth.guard.ts                   (CanActivate: requires authenticated)
│   │   └── project-role.guard.ts           (CanActivate: requires global Admin OR active project role)
│   ├── api/
│   │   ├── api-client.ts                   (typed wrapper around HttpClient)
│   │   └── dto/                            (shared DTO types — generated from OpenAPI later)
│   └── time/
│       └── now.ts                          (clock helper, mockable in tests)
└── features/
    └── auth/
        ├── login/
        │   └── login.component.ts          (LoginPage)
        ├── profile/
        │   └── profile.component.ts        (ProfilePage)
        ├── password-reset/
        │   ├── request-reset.component.ts  (RequestResetPage)
        │   └── confirm-reset.component.ts  (ConfirmResetPage)
        ├── verify-email/
        │   └── verify-email.component.ts   (VerifyEmailPage)
        └── invite-accept/
            └── invite-accept.component.ts  (InviteAcceptPage — token-in-URL)
```

## Components — Props, State, Interactions

### `LoginPage`
- **Props**: none.
- **Inputs**: `email`, `password` (reactive form).
- **State (Signals)**: `pending: boolean`, `error: string | null`.
- **Validation**: email format, password min length 8.
- **Actions**:
  - `onSubmit()` → `POST /api/v1/auth/login`. On success, store `accessToken`, fetch profile
    via `GET /api/v1/auth/me`, route to `/dashboard`.
- **API endpoints**:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`

### `ProfilePage`
- **Props**: none (uses `currentUser` Signal).
- **Inputs (form)**: `name`, `organization`, `greenRaterCredentialId` (visible/editable only when
  the user has at least one active `GREEN_RATER` membership; otherwise hidden).
- **State**: `saving: boolean`, `error: string | null`.
- **Actions**:
  - `save()` → `PUT /api/v1/users/me`.
- **API endpoints**:
  - `GET /api/v1/users/me`
  - `PUT /api/v1/users/me`

### `RequestResetPage`
- **Inputs**: `email`.
- **State**: `submitted: boolean` (shows generic confirmation regardless of result — BR-A3).
- **Actions**:
  - `request()` → `POST /api/v1/auth/password/reset/request`.
- **Validation**: email format.

### `ConfirmResetPage`
- **Route**: `/auth/password/reset?token=...`.
- **Inputs**: `newPassword`, `confirmPassword`.
- **State**: `pending`, `error`, `success`.
- **Validation**: min length 8; both fields equal.
- **Actions**:
  - `submit()` → `POST /api/v1/auth/password/reset/confirm` with `{ token, newPassword }`.
  - On success → redirect to `/login` with a "password updated" toast.

### `VerifyEmailPage`
- **Route**: `/auth/verify-email?token=...`.
- **State**: `state: 'verifying' | 'verified' | 'invalid'`.
- **Actions**: on init, `POST /api/v1/auth/email/verify` with `{ token }`.

### `InviteAcceptPage`
- **Route**: `/invitations/accept?token=...`.
- **State (Signals)**: `state: 'loading' | 'invalid' | 'expired' | 'needs-login' | 'needs-account' |
  'ready' | 'success' | 'error'`, `invitePreview: { projectName, projectRole, inviterName } | null`,
  `pending`, `error`.
- **Flow**:
  1. On init: `GET /api/v1/invitations/preview?token=...` to load invite preview without consuming.
  2. Branch:
     - If invitee account exists and the user is **not** authenticated → state `needs-login`,
       show login form (post-login: re-call `POST /api/v1/invitations/accept`).
     - If invitee email has no account → state `needs-account`, show account creation form
       (`email` pre-filled and read-only; `password`, `confirmPassword`).
     - If user is authenticated and email matches → state `ready`, show "Accept" button.
  3. On accept → `POST /api/v1/invitations/accept` with `{ token, [password] }`.
  4. On success → store access token (if returned), navigate to `/projects/:projectId`.
- **Errors**:
  - `410` (gone / expired / wrong state) → state `expired` with re-invite guidance.
  - `409` (already has different role) → state `error` with guidance per BR-I3.

## Route Guards

### `authGuard`
- Allows the route only if `authService.currentUser()` is non-null and the access token is valid.
- Otherwise, navigates to `/login` preserving `redirectTo`.

### `projectRoleGuard`
- Configurable per route via `data: { allowedProjectRoles: ['PROJECT_TEAM','GREEN_RATER'] }` (or `['*']`).
- Resolves `:projectId` from the route, queries `GET /api/v1/projects/:projectId/me-role`, allows
  if `globalRole = ADMIN` OR the response role is in the allowed set; else navigates to a 403 page.

## Interceptors
- `authInterceptor` — attaches `Authorization: Bearer <token>`; on 401 clears local state and
  navigates to `/login`.
- `errorInterceptor` — surfaces backend `error` payloads as user-friendly messages; 403 routes to a
  shared "Not authorized" page.

## State Management
- A single `AuthService` exposes:
  - `currentUser = signal<Profile | null>(null)`,
  - `accessToken = signal<string | null>(null)` (kept in memory; localStorage optional and toggled
    via env for demo persistence).
  - `login(email, password)`, `logout()`, `refreshProfile()`.
- All other Unit 1 pages read from `currentUser` and call `AuthService` actions.

## Form Validation Rules
- Email: required, RFC-5322-lite (Angular built-in `Validators.email`).
- Password: required, min 8 (`Validators.minLength(8)`).
- Confirm password: equal to password (custom validator).
- `name`, `organization`: optional, max 255.
- `greenRaterCredentialId`: optional, max 64; visible only if the user has a `GREEN_RATER`
  membership (driven by a Signal computed from `currentUser` + recent memberships).

## API Endpoints Used (Unit 1)
| Component | Method | Path |
|---|---|---|
| LoginPage | POST | `/api/v1/auth/login` |
| LoginPage | GET | `/api/v1/auth/me` |
| ProfilePage | GET / PUT | `/api/v1/users/me` |
| RequestResetPage | POST | `/api/v1/auth/password/reset/request` |
| ConfirmResetPage | POST | `/api/v1/auth/password/reset/confirm` |
| VerifyEmailPage | POST | `/api/v1/auth/email/verify` |
| InviteAcceptPage | GET | `/api/v1/invitations/preview` |
| InviteAcceptPage | POST | `/api/v1/invitations/accept` |
| projectRoleGuard | GET | `/api/v1/projects/:projectId/me-role` |

(Backend route surface for these is finalized during Code Generation; routes are conventions per
Application Design Q5=A.)

## Accessibility & Mobile
- All forms use Angular Material with proper `mat-form-field` semantics, ARIA labels, and visible
  focus states.
- Layouts are responsive from the foundation; PWA service worker and full mobile polish land in
  Unit 9, but Unit 1 should not introduce desktop-only patterns.

## PBT Notes (frontend)
- Pure validators (e.g., the `equalToControl(...)` confirm-password validator) are good PBT targets:
  property "for any string `s`, equalTo(s)(s) is valid; equalTo(s)(s2) is invalid iff s !== s2".
- The clock helper `now()` is mockable to make Signals computations driven by time deterministic
  for PBT.
