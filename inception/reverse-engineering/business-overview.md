# Business Overview

## Business Context Diagram

```mermaid
flowchart LR
    PT["Project Team"]
    GR["Green Rater / Provider"]
    RA["Reviewer / GBCI Admin"]
    FE["Angular Frontend<br/>(separate app)"]
    BE["USGBC Hub Residential<br/>Backend (NestJS)"]
    AUTH0["Auth0 / USGBC IdP<br/>(QAS tenant)"]
    DB[("PostgreSQL")]

    PT --> FE
    GR --> FE
    RA --> FE
    FE -->|Bearer token / login| BE
    BE -->|JWKS verify (auth0 mode)| AUTH0
    BE -->|users + roles| DB
```

## Business Description

- **Business Description**: USGBC Hub Residential is the backend foundation for a LEED Residential
  certification platform (aligned with the GBCI Certify platform and LEED v4.1 Residential rating
  system). The current codebase implements the **authentication and authorization slice only**:
  users log in (local email/password or Auth0), and the system enforces role-based access control
  for three MVP personas involved in the residential certification workflow. The broader
  certification features (registration, payment, workbook editing, verification submittals, AI
  pre-review, scoring, invoicing, certification status) are represented today only as a
  **permission catalog** awaiting feature implementation.

- **Business Transactions** (currently implemented):
  - **User Login (local)**: Validate email/password, issue an app-signed JWT.
  - **Authenticate Request**: Verify a bearer token (local JWT or Auth0 JWKS) on every protected route.
  - **Get Profile / Roles**: Return the authenticated user's identity, roles, and derived permissions.
  - **Create User**: A Reviewer/Admin creates a user with an assigned role.
  - **Update Role Assignment**: A Reviewer/Admin changes a user's role.
  - **Seed Users/Admins on Startup**: Bootstrap demo accounts and admin emails from configuration.
  - **Health Check**: Public liveness endpoint.

- **Business Transactions** (anticipated, encoded as permissions but not yet built): Registration,
  Payment, Workbook view/edit, Verification editing, Submittal document upload, AI pre-review,
  Submit for review, Review phase management, Award points / review notes, Generate review report,
  Quality scoring, Invoicing, Certification status updates.

## Business Dictionary

- **LEED Residential**: Green building certification program for single-family/residential projects.
- **Project Team**: The applicant team registering and paying for a project; read-only on workbook/status.
- **Green Rater / Provider**: Edits the workbook and verification data, uploads submittals, submits for review.
- **Reviewer / GBCI Admin**: GBCI staff with full project control — review phase, scoring, invoicing, admin.
- **Workbook**: The LEED scorecard/verification worksheet for a project (future feature).
- **Verification Submittals**: Evidence documents supporting credit achievement (future feature).
- **AI Pre-Review**: Automated pre-screening of a submission before human review (future feature).
- **Permission**: A granular capability (e.g., `edit_workbook`) derived from a user's role(s).
- **Role**: One of `project_team`, `green_rater`, `reviewer_admin`.

## Component Level Business Descriptions

### Auth Module
- **Purpose**: Authenticate users and authorize requests for the residential platform.
- **Responsibilities**: Local login + JWT issuance, Auth0 JWKS verification, mock auth for demos,
  global route protection, role-based authorization, profile/permission resolution, admin user
  creation and role reassignment.

### Users Module
- **Purpose**: Own the source of truth for user identity and role assignment.
- **Responsibilities**: Persist users (Postgres/TypeORM), validate credentials, find-or-create on
  first login, seed demo users/admins, set roles.

### Common Module
- **Purpose**: Cross-cutting infrastructure.
- **Responsibilities**: Structured logging with secret masking, request/response middleware,
  global exception handling.

### Config & Health
- **Purpose**: Validated configuration loading (fail-fast) and a public liveness endpoint.
