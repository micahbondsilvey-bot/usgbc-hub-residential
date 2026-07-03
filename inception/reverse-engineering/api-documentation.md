# API Documentation

Base: NestJS REST API. Global `ValidationPipe` (whitelist, transform, forbidNonWhitelisted).
Auth: global `JwtAuthGuard` — all routes require a Bearer token unless marked `@Public()`.
Swagger UI served at `/api-docs`.

## REST APIs

### Health Check
- **Method**: GET
- **Path**: `/health`
- **Auth**: Public
- **Purpose**: Liveness check.
- **Response**: `{ "status": "ok", "timestamp": "<ISO>" }`

### Login
- **Method**: POST
- **Path**: `/auth/login`
- **Auth**: Public
- **Purpose**: Validate local email/password, return access token + profile.
- **Request** (`LoginDto`): `{ "email": string(email), "password": string(min 8) }`
- **Response** (200): `{ "accessToken": string, "profile": ProfileDto }`
- **Errors**: 401 invalid credentials.

### Get Profile
- **Method**: GET
- **Path**: `/auth/me`
- **Auth**: Bearer
- **Purpose**: Return authenticated user profile, roles, permissions.
- **Response** (`ProfileDto`): `{ sub, email, name?, roles[], permissions[] }`

### Get Roles
- **Method**: GET
- **Path**: `/auth/role`
- **Auth**: Bearer
- **Purpose**: Roles (with labels) and derived permissions.
- **Response**: `{ roles: [{ value, label }], permissions: Permission[] }`

### Create User
- **Method**: POST
- **Path**: `/auth/users`
- **Auth**: Bearer + role `reviewer_admin`
- **Purpose**: Create a local user with a role.
- **Request** (`CreateUserDto`): `{ email, password(min 8), name?, role(enum) }`
- **Response** (201): `ProfileDto`
- **Errors**: 409 if email exists; 403 if not admin.

### Update Role
- **Method**: PUT
- **Path**: `/auth/users/role`
- **Auth**: Bearer + role `reviewer_admin`
- **Purpose**: Reassign a user's role.
- **Request** (`UpdateRoleDto`): `{ email, role(enum) }`
- **Response** (200): `ProfileDto`
- **Errors**: 404 if no user with that email; 403 if not admin.

## Internal APIs

### AuthService
- `login(email, password)` → `{ accessToken, profile }`
- `resolveUser(token?)` → `AuthUser` (branches on mock/local/auth0)
- `getProfile(user)` → `{ sub, email, name?, roles[], permissions[] }`

### LocalAuthService
- `login(email, password)` → `{ accessToken, sub, email, role }` (HS256, issuer `usgbc-hub-residential-be`)
- `verify(token)` → `{ sub, email, role }`

### JwtVerifierService
- `verify(token)` → `VerifiedClaims` (RS256 via JWKS; checks issuer, audience, expiry, clock tolerance)

### UsersService
- `createUser({email,password,name?,role})` → `User`
- `validateCredentials(email,password)` → `User | null`
- `findById(id)` / `findByEmail(email)` → `User | null`
- `findOrCreate({sub,email,name?,claimRoles?})` → `User`
- `setRole(email, role)` → `User | null`

## Data Models

### User (entity → `users` table)
- **Fields**: `id` (uuid PK), `auth0Sub` (unique), `email` (unique), `name` (nullable),
  `passwordHash` (nullable, bcrypt), `role` (enum, default `project_team`),
  `createdAt`, `updatedAt`.
- **Relationships**: None (single table).
- **Validation**: Enforced at DTO layer; uniqueness via DB indexes on `auth0Sub` and `email`.

### Role (enum)
- `project_team`, `green_rater`, `reviewer_admin`.

### Permission (enum) — derived from role via `ROLE_PERMISSIONS`
- Project Team: `registration`, `payment`, `view_workbook`, `view_project_status`, `accept_certification`.
- Green Rater: `registration`, `payment`, `upload_submittal_docs`, `edit_workbook`, `edit_verification`,
  `run_ai_pre_review`, `submit_for_review`, `add_green_rater_notes`, `view_workbook`, `view_project_status`.
- Reviewer/Admin: `view_full_project`, `start_review_phase`, `run_ai_pre_review`,
  `add_review_notes_award_points`, `generate_review_report`, `input_quality_scores`,
  `edit_project_details`, `update_role_assignments`, `update_certification_status`, `invoicing`.
