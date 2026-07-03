# Component Inventory

## Application Packages
- `usgbc-hub-residential-be` — NestJS backend (auth/authorization slice of the residential platform).

### Internal Modules (within the backend package)
- `auth` — Authentication, authorization, profile/permissions, admin user management.
- `users` — User persistence, credential validation, seeding, role assignment.
- `common` — Logger (with masking), request/response middleware, global exception filter.
- `config` — Validated configuration loader + Swagger setup.
- `health` — Public liveness endpoint.

## Infrastructure Packages
- None (no CDK/Terraform/CloudFormation). `docker-compose.yml` provides a local PostgreSQL only.

## Shared Packages
- None (intentionally self-contained; no shared private library).

## Test Packages
- None present in `src/`. Jest + Supertest are configured in `package.json` (`test`, `test:e2e`)
  but no test files were found in the source tree.

## Total Count
- **Total Packages**: 1 application package (single backend service)
- **Application**: 1 (with 5 internal modules)
- **Infrastructure**: 0
- **Shared**: 0
- **Test**: 0 (tooling configured, no tests authored)
