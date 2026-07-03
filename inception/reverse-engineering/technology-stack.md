# Technology Stack

## Programming Languages
- TypeScript — ~4.7.4 — All application source.
- JavaScript — Node.js 20.13.1 runtime; `scripts/init-db.js` helper.

## Frameworks
- NestJS — ^9.4.3 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) — Application framework.
- @nestjs/config — ^2.3.4 — Configuration management.
- @nestjs/swagger — ^6.3.0 — OpenAPI/Swagger UI.
- @nestjs/typeorm — ^9.0.1 + TypeORM ^0.3.17 — ORM/persistence.
- Express (via platform-express) — ^4.17 types — HTTP server.

## Infrastructure
- PostgreSQL — Primary data store (local via Docker Compose).
- Docker Compose — Local Postgres provisioning.

## Build Tools
- @nestjs/cli — ^9.5.0 — Build/start.
- TypeScript compiler — ~4.7.4.
- ts-node / ts-loader — Dev/build support.

## Security & Auth Libraries
- jsonwebtoken — ^9.0.2 — HS256 local token sign/verify.
- jwks-rsa — ^3.0.1 — Auth0 RS256 JWKS key resolution.
- bcryptjs — ^3.0.3 — Password hashing.
- helmet — ^7.0.0 — HTTP security headers.
- class-validator ^0.14.0 / class-transformer ^0.5.1 — DTO validation.

## Testing Tools (configured, not yet used)
- Jest — ^29.6.2.
- Supertest — ^6.3.3 (e2e).
- ts-jest — ^29.1.1.

## Code Quality Tools
- ESLint — ^8.46.0 (+ @typescript-eslint ^5.62.0).
- Prettier — ^3.0.0.
