# Unit 9 — Mobile/PWA & Scheduling — Code Generation Plan

**Cadence**: NFR Requirements + NFR Design SKIPPED for U9. Tests skipped per
the documented PBT deviation; FL-20 (compression plan invariants) and FL-21
(mock-URL determinism) properties identified.

**Scope**: US-7.5 + US-9.1 + US-9.2 + US-9.3.

**Approach**: Phase A (backend, Steps 1-12) → Phase B (frontend PWA + camera +
scheduling, Steps 13-26) → Phase C (responsive polish + docs + validation,
Steps 27-36).

---

## Phase A — Backend (Steps 1-12)

### A.1 — Enums + entity

- [x] **1.** Create `src/scheduling/enums/scheduling.enums.ts` exporting
      `SchedulingProviderKey`, `SchedulingLinkStatus`, `SCHEDULING_PROVIDER`
      token.
- [x] **2.** Create `src/scheduling/scheduling-link.entity.ts` (UUID PK, all
      columns per `domain-entities.md`, inherits `AuditBase`, one index).

### A.2 — DTOs

- [x] **3.** Create `src/scheduling/dto/scheduling-link.dto.ts` (`SchedulingLinkDto`
      + `SchedulingLinksListDto`).
- [x] **4.** Create `src/scheduling/dto/create-scheduling-link.dto.ts` with
      optional `reviewId` + `reviewerUserId` (class-validator `@IsOptional`,
      `@IsUUID`).

### A.3 — Provider seam + mock impl

- [x] **5.** Create `src/scheduling/provider/scheduling.provider.ts`
      (interface + token re-export).
- [x] **6.** Create `src/scheduling/provider/mock-ms-bookings.provider.ts`
      with the deterministic `buildMockBookingUrl` helper (FL-21 subject).

### A.4 — Orchestrator service

- [x] **7.** Create `src/scheduling/scheduling.service.ts`:
      - `createBooking(projectId, body, actor)` — Flow 1.
      - `listLinks(projectId, actor)` — Flow 2.
      - RBAC (Reviewer/Admin for create; any member/Admin for read).
      - Audit on create.
      - Infer `reviewerUserId` from the project's most recent review when
        unspecified (best-effort).

### A.5 — Controller + module

- [x] **8.** Create `src/scheduling/scheduling.controller.ts`. Routes:
      - `POST /api/v1/projects/:projectId/scheduling/booking`
      - `GET /api/v1/projects/:projectId/scheduling/links`
      All gated by `ProjectRolesGuard` + `@ProjectRoles('*')`.
- [x] **9.** Create `src/scheduling/scheduling.module.ts`:
      - `TypeOrmModule.forFeature([SchedulingLink, ProjectMembership, Review])`.
      - Imports: `AuditModule`, `MembershipModule`.
      - Providers: `SchedulingService` + `{ provide: SCHEDULING_PROVIDER,
        useClass: MockMsBookingsProvider }`.
      - Controllers: `SchedulingController`.

### A.6 — Wiring

- [x] **10.** Update `src/app.module.ts`:
      - Import `SchedulingModule`.
      - Register `SchedulingLink` entity in `TypeOrmModule.forRoot.entities`.

### A.7 — Validation

- [x] **11.** Add `class-validator` decorators on `CreateSchedulingLinkDto`
      (`@IsOptional() @IsUUID() reviewId`, same for `reviewerUserId`).
- [x] **12.** Use `ParseUUIDPipe` on `:projectId` route param.

---

## Phase B — Frontend (Steps 13-26)

### B.1 — DTOs + ApiClient

- [x] **13.** Extend `src/app/core/api/dto.ts` with the U9 shapes.
- [x] **14.** Extend `src/app/core/api/api-client.ts` with the 2 new methods.

### B.2 — Pure compression planner

- [x] **15.** Create `src/app/shared/image/compression.ts` with the
      `planCompression(input)` pure function (FL-20).

### B.3 — Camera capture component

- [x] **16.** Create `src/app/shared/camera-capture/camera-capture-button.component.ts`.
      - Hidden file input with `accept="image/*" capture="environment"`.
      - On change: read dimensions, plan compression, draw to canvas,
        emit compressed `File`.

### B.4 — Scheduling store + button

- [x] **17.** Create `src/app/features/scheduling/scheduling.store.ts`.
- [x] **18.** Create `src/app/features/scheduling/scheduling-button.component.ts`.

### B.5 — Host integrations

- [x] **19.** Update `CreditSubmittalsComponent` to render the camera
      capture button next to the file input. Add `onCameraCaptured(file)`
      handler that delegates to the existing upload path.
- [x] **20.** Update `ReviewPageComponent` to render the scheduling button in
      the "returned" block.

### B.6 — PWA assets

- [x] **21.** Create `src/manifest.webmanifest`.
- [x] **22.** Create `src/service-worker.js` (cache-first, API bypass).
- [x] **23.** Update `src/index.html`:
      - Add `<link rel="manifest" href="manifest.webmanifest">`.
      - Add `<meta name="theme-color" content="#1976d2">`.
      - Add `<link rel="apple-touch-icon" ...>` if appropriate (skip for this
        build).
- [x] **24.** Update `src/main.ts` to register the service worker in
      production.
- [x] **25.** Update `angular.json` build assets to include `manifest.webmanifest`
      + `service-worker.js`.

### B.7 — Responsive styles

- [x] **26.** Extend `src/styles.scss` with the global `@media (max-width:
      600px)` rules from `frontend-components.md` (touch targets, padding,
      table sizing).

---

## Phase C — Documentation + Validation (Steps 27-36)

- [x] **27.** Create `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/code/README.md`.
- [x] **28.** Update `usgbc-hub-residential-be/README.md` to "Units 1–9
      complete" with U9 endpoint quick reference.
- [x] **29.** Update `usgbc-hub-residential-fe/README.md` to "Units 1–9
      complete" with PWA installability + camera capture notes.
- [x] **30.** Update `aidlc-docs/inception/application-design/unit-of-work-story-map.md`:
      mark US-7.5, US-9.1, US-9.2, US-9.3 as `[x] U9`.
- [x] **31.** Update `aidlc-state.md`: U9 row → FD ✅, NFRR `— (skipped)`,
      NFRD `— (skipped per user)`, CodeGen ✅; Feature → Unit map U9 rows → ✅;
      Current Stage line.
- [x] **32.** Run `npm run build` in both BE + FE; capture clean output.
- [x] **33.** Run `get_diagnostics` on every new/modified TypeScript file.
- [x] **34.** Verify the manifest is installable per Lighthouse criteria
      (manual: theme_color present, icon present, start_url present, display
      standalone). Not blocking.
- [x] **35.** Build the production bundle to validate the service worker is
      copied to the `dist/` root.
- [x] **36.** Note the documented test-skip deviation in the U9 README.

---

## Story coverage table

| Story | Steps |
|---|---|
| US-7.5 Schedule review call via MS Bookings (mocked) | 1-12 (BE), 13-14, 17-18, 20 (FE) |
| US-9.1 Responsive PWA layout | 21-26 |
| US-9.2 Mobile field verification with camera upload | 15, 16, 19 |
| US-9.3 Mobile Green Rater dashboard | 26 (responsive only) |
| Cross-cutting RBAC | 7, 8 |
| Cross-cutting audit | 7 |
| PBT-01 properties | 6 (FL-21), 15 (FL-20) |
| Documentation | 27-31 |
| Validation | 32-36 |

---

## PBT compliance for this unit

- **PBT-01** — COMPLIANT. Two properties documented with pure subjects:
  - **FL-20** Image-compression plan invariants — pure `planCompression(input)`.
  - **FL-21** Mock-URL determinism — pure `buildMockBookingUrl(projectId, reviewerUserId)`.
- **PBT-09** — COMPLIANT (fast-check carried over).
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION.
