# Unit 9 — Mobile/PWA & Scheduling — Code (Brownfield)

Implementation summary for Unit 9. Tests skipped per the documented PBT
deviation carried forward from Unit 1; FL-20 (compression plan invariants)
and FL-21 (mock-URL determinism) properties identified.

## Files

### Backend (`usgbc-hub-residential-be/src/scheduling/`)
- `enums/scheduling.enums.ts` — `SchedulingProviderKey`,
  `SchedulingLinkStatus`, `SCHEDULING_PROVIDER` token.
- `scheduling-link.entity.ts` — `scheduling_link` table + 1 index.
- `dto/scheduling-link.dto.ts` — wire DTOs.
- `dto/create-scheduling-link.dto.ts` — POST body with class-validator
  decorators.
- `provider/scheduling.provider.ts` — interface + token re-export.
- `provider/mock-ms-bookings.provider.ts` — mock impl with the pure
  `buildMockBookingUrl(projectId, reviewerUserId)` helper. PBT subject FL-21.
- `scheduling.service.ts` — orchestrator: `createBooking`, `listLinks` with
  RBAC + audit + reviewer inference from the latest review.
- `scheduling.controller.ts` — 2 routes under `projects/:projectId/scheduling`.
- `scheduling.module.ts` — wiring.

### Backend (modified)
- `app.module.ts` — imports `SchedulingModule`; registers `SchedulingLink`
  entity in `TypeOrmModule.forRoot.entities`.

### Frontend
- `src/app/shared/image/compression.ts` — **pure** `planCompression(input)`
  + `MAX_DIM`, `MAX_BYTES` constants. PBT subject FL-20.
- `src/app/shared/camera-capture/camera-capture-button.component.ts` —
  Material button that opens the device camera, runs the file through
  `planCompression` + canvas re-encode, emits a compressed `File`.
- `src/app/features/scheduling/scheduling.store.ts` — signal-backed store
  with per-project list + create methods.
- `src/app/features/scheduling/scheduling-button.component.ts` — CTA
  embedded on the Review page (returned-review block).

### Frontend (modified)
- `core/api/dto.ts` — adds 2 enums + 3 DTOs.
- `core/api/api-client.ts` — adds 2 methods (`createSchedulingLink`,
  `listSchedulingLinks`).
- `features/scorecard/components/credit-detail/credit-submittals.component.ts` —
  renders the camera-capture button next to the existing file `<input>`.
  Submitted photos go through the same `WorkbookStore.uploadFile` path.
- `features/review/review-page.component.ts` — embeds the scheduling button
  in the returned-review block.

### PWA shell (new)
- `src/manifest.webmanifest` — installable metadata (`display: standalone`,
  theme color, icons).
- `src/service-worker.js` — minimal cache-first SW that bypasses `/api/*`
  (BR-MS10). Bumps cache key via the `CACHE` constant when breaking changes
  ship.
- `src/index.html` — adds `<link rel="manifest">`, `theme-color` meta,
  mobile-web-app-capable meta tags.
- `src/main.ts` — registers the service worker on `load`; silent-fail when
  the file isn't served (dev server).
- `angular.json` — adds `manifest.webmanifest` + `service-worker.js` to the
  build assets list.

### Responsive styles
- `src/styles.scss` — appends a `@media (max-width: 600px)` block that
  enforces ≥ 44px touch targets, larger form controls, condensed table
  font, and stacked dashboard grids. Plus a `@media (max-width: 900px)`
  block that reduces tablet grid gaps.

## Endpoints

```
POST   /api/v1/projects/:projectId/scheduling/booking   (body: { reviewId?, reviewerUserId? })   → 201 SchedulingLinkDto
GET    /api/v1/projects/:projectId/scheduling/links                                                → SchedulingLinksListDto
```

RBAC (BR-MS2):
- `POST` requires `ProjectRoles(REVIEWER)` or `GlobalRole.ADMIN`.
- `GET` requires any project membership or `GlobalRole.ADMIN`.

## PBT compliance

- **FL-20** Image compression plan invariants — pure `planCompression(input)`
  in `src/app/shared/image/compression.ts`. Properties:
  - `max(targetWidth, targetHeight) <= MAX_DIM (1600)`.
  - `min(targetWidth, targetHeight) <= min(originalWidth, originalHeight)`.
  - Aspect ratio preserved within ±1px (rounding tolerance).
- **FL-21** Mock booking URL determinism — pure `buildMockBookingUrl(projectId,
  reviewerUserId)` in `src/scheduling/provider/mock-ms-bookings.provider.ts`.
  Same inputs ⇒ same URL.
- **PBT-09** Framework — fast-check carried over.
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per U1 precedent).

## Scope deviations

- No real MS Bookings integration. The `SchedulingProvider` seam is bound
  to `MockMsBookingsProvider` via `useClass`. A future real impl swaps the
  binding.
- No offline writes. The service worker caches static assets only; `/api/*`
  is never intercepted.
- Camera capture works on iOS Safari + Android Chrome (the common field
  browsers). Desktop browsers fall back to the file picker.
- Cancellation flow for `scheduling_link.status` is reserved in the schema
  but not exposed; no endpoint ships in this build.

## Validation

- `tsc --noEmit` clean on all U9 BE files (covered by `nest build`).
- `nest build` clean.
- `ng build` clean (FE).
- `manifest.webmanifest` + `service-worker.js` confirmed copied to
  `dist/usgbc-hub-residential-fe/browser/` by the production build.
- `get_diagnostics` clean across all new + modified files (BE + FE).
