# Unit 9 — Business Rules

Rule IDs use the `BR-MS*` prefix (Mobile / Scheduling). Cross-cutting rules
from U1 (audit, RBAC), U4 (submittals), and U5 (review) are inherited
unchanged.

---

## BR-MS1 — Scheduling is advisory link-out
- The `SchedulingProvider` never modifies project, review, or scorecard state.
- The booking URL is for human use; the BE does not poll back to verify the
  call was actually scheduled with MS Bookings.
- Direct quote from US-7.5: "real MS Bookings integration is deferred."

## BR-MS2 — Scheduling RBAC
- `POST /api/v1/projects/:projectId/scheduling/booking` requires
  `ProjectRoles(REVIEWER)` OR `GlobalRole.ADMIN` (consistent with the U5
  return-flow ownership).
- `GET /api/v1/projects/:projectId/scheduling/links` requires any project
  membership OR `GlobalRole.ADMIN`.

## BR-MS3 — Mock booking URL determinism (FL-21 subject)
- `MockMsBookingsProvider.create({ projectId, reviewerUserId, … })` returns
  `bookingUrl = 'https://bookings.microsoft.com/usgbc-mock/${projectId}/${reviewerUserId}'`.
- `externalRef` is constructed as `'mock-${projectId.slice(0,8)}-${reviewerUserId.slice(0,8)}-${createdAt-iso}'`.
- Same inputs ⇒ same `bookingUrl` (the `externalRef` carries the timestamp
  for uniqueness across multiple creations).

## BR-MS4 — Scheduling link lifecycle
- New rows always insert with `status = CREATED`.
- `version` starts at 1.
- Cancellation (`status = CANCELLED`) is not exposed in this build.

## BR-MS5 — Scheduling audit (cross-cut with U1)
- Every successful `POST /scheduling/booking` writes an `AuditLog` row:
  - `entityType: 'scheduling_link'`, `entityId: linkId`
  - `action: AuditAction.CREATE`
  - `metadata: { projectId, reviewerUserId, reviewId }`

## BR-MS6 — Mobile touch-target floor
- All interactive elements in the FE shell + workbook + dashboards must
  render at ≥ 44px tall on viewports ≤ 600px wide (Apple HIG / WCAG 2.5.5
  best practice).
- Implementation: a global rule in `styles.scss` setting
  `button, .gbci-button, .mat-mdc-button` to `min-height: 44px` under the
  600px breakpoint.

## BR-MS7 — Installable PWA
- `manifest.webmanifest` declares the app shell metadata so browsers expose
  the "Add to Home Screen" action.
- Service worker is registered (`navigator.serviceWorker.register('/service-worker.js')`)
  but is a no-op cache shell — its purpose is to satisfy installability
  criteria, not deliver offline behavior in this build.

## BR-MS8 — Camera-captured images obey size limits
- The compressed file MUST be ≤ `MAX_BYTES = 25 MB` (same cap as the existing
  submittal upload).
- The pure planning step (FL-20) chooses `targetWidth/targetHeight` such that
  `max(target) <= MAX_DIM (1600px)` and `qualityHint = 0.85` for files that
  start ≥ 1 MB and `0.9` otherwise.

## BR-MS9 — Camera-captured files are renamed
- Native camera captures arrive with a default filename like `image.jpg` or
  `IMG_0001.HEIC`. The capture component renames to
  `camera-capture-${Date.now()}.jpg` so duplicates don't collide on the slot's
  unique-by-name constraint (if any).
- The renaming is FE-only; the BE accepts any filename.

## BR-MS10 — Service-worker scope
- The service worker SHOULD NOT intercept `/api/*` requests in this build.
  All API mutations bypass the cache (network-only). Static assets (HTML,
  JS, CSS, fonts) cache with a basic cache-first strategy.
