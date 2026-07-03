# Unit 9 — Mobile/PWA & Scheduling — Batched Design Plan (FD only)

**Cadence**: NFR Requirements + NFR Design SKIPPED for U9 (carried forward from
U3..U8). Tests skipped per the documented PBT deviation; PBT-01 property FL-20
(image-compression invariant) identified.

**Scope**: US-7.5 (MS Bookings link-out — mocked), US-9.1 (Responsive PWA
layout), US-9.2 (Mobile field verification with camera upload + client-side
image compression), US-9.3 (Mobile-accessible Green Rater dashboard).

**Out of scope (deferred to a future build)**:
- Real MS Bookings integration. The `SchedulingProvider` seam is bound to a
  mock impl that synthesizes a stable demo booking URL.
- Server-side image processing. Compression is entirely client-side.
- Offline-first workbook editing (offline reads of static assets ship; offline
  writes do not — the API requires network).

---

## Stories in scope

| Story | Title | Personas | Acceptance summary |
|---|---|---|---|
| US-7.5 | Schedule review call via MS Bookings (mocked/link-out) | P3, P2 | Reviewer triggers scheduling; system generates booking link via mock; action + URL recorded on the project. |
| US-9.1 | Responsive PWA layout | All | Layouts adapt to phone/tablet, large touch targets, installable as a PWA. |
| US-9.2 | Mobile field verification with camera upload | P2 | Mobile field checklist usable; photos can be captured from the device camera; client-side compression before upload. |
| US-9.3 | Mobile Green Rater dashboard | P2 | Existing GR dashboard renders + functions on mobile (responsive only). |

---

## Q1–Q10 design questions (recommended "A" answers indicated)

### Q1 — PWA enablement approach
- **A (recommended)**: Manual lightweight install — write `manifest.webmanifest`
  + `service-worker.js` + register from `main.ts`. Avoids adding the
  `@angular/service-worker` package and its build pipeline integration for this
  brownfield ship. Service worker uses a basic cache-first strategy for static
  assets and bypasses (network-only) for `/api/*` calls.
- B: Add `@angular/service-worker` + `ngsw-config.json` (more setup, more
  reliable for production).
- C: Skip service worker; just add manifest for installability.

### Q2 — Mobile responsive layout strategy
- **A (recommended)**: Global `styles.scss` adjustments only — bump touch
  targets to ≥ 44px, add media-query breakpoints for ≤ 600px / ≤ 900px,
  switch header nav to wrap. Per-component responsive tweaks where critical
  (workbook page, scorecard, dashboard pages). No restructuring of routes
  or layouts.
- B: Per-component layout rewrites with `@media` queries.
- C: Side-by-side mobile shell route.

### Q3 — Scheduling seam
- **A (recommended)**: `SchedulingProvider` injection token with
  `MockMsBookingsProvider` impl. Method:
  `createBookingUrl(input: BookingInput): Promise<{ url, providerKey,
  externalRef }>`. The mock returns a deterministic URL based on the project
  + reviewer (e.g. `https://bookings.microsoft.com/usgbc-mock/<projectId>/<reviewerUserId>`).
- B: Stub directly in the controller.
- C: Real MS Bookings API.

### Q4 — Scheduling storage
- **A (recommended)**: One new table `scheduling_link`:
  - `id`, `projectId`, `reviewId | null` (nullable so non-review scheduling
    can land later), `createdByUserId`, `providerKey` (`'MS_BOOKINGS_MOCK'`),
    `externalRef`, `bookingUrl`, `status` (`CREATED | CANCELLED`), `version`,
    `AuditBase`.
- B: Add a `bookingUrl` column to `Review`. Simpler but couples scheduling to
  reviews.
- C: Just emit an audit row.

### Q5 — Scheduling endpoints
- **A (recommended)**:
  - `POST /api/v1/projects/:projectId/scheduling/booking` — body
    `{ reviewId?, reviewerUserId? }` → returns `SchedulingLinkDto`.
  - `GET /api/v1/projects/:projectId/scheduling/links` — list latest 10.
  - RBAC: Reviewer + Admin can create; project members can read.

### Q6 — Camera capture
- **A (recommended)**: A new `gbci-camera-capture-button` component:
  - Renders a `<button>` that programmatically clicks a hidden
    `<input type="file" accept="image/*" capture="environment">`.
  - On change, runs the file through a pure `compressImage(blob, opts)` helper
    that loads it onto an `HTMLCanvasElement`, resizes proportionally to fit
    within `MAX_DIM = 1600px`, and re-encodes to `image/jpeg` at quality `0.85`.
    Returns the compressed `Blob`.
  - Calls a parent callback with the compressed `File` (renamed `.jpg`).
- B: Use `getUserMedia` directly (more code, no extra benefit for this build).

### Q7 — Compression invariant
- **A (recommended)**: Pure `planCompression(input: { width, height,
  byteLength }): { targetWidth, targetHeight, qualityHint }` is the **FL-20**
  PBT-01 subject. Properties:
  1. `min(targetWidth, targetHeight) <= original`
  2. `max(targetWidth, targetHeight) <= MAX_DIM`
  3. Aspect ratio preserved within ±1px.
  The actual canvas re-encoding is **not** pure (it depends on the browser),
  but the planning step is.

### Q8 — Workbook integration
- **A (recommended)**: Add the `gbci-camera-capture-button` next to the
  existing file `<input>` inside `CreditSubmittalsComponent`. On a small
  screen (`@media (max-width: 600px)`) the file input is hidden in favor of
  the camera button. On larger screens both are shown.

### Q9 — Mobile dashboard (US-9.3)
- **A (recommended)**: Pure CSS — add `@media (max-width: 600px)` rules to
  `dashboard-green-rater-page.component.ts` and the shared dashboard partials
  so cards stack vertically and tables become condensed lists. No new
  components.

### Q10 — PBT subjects
- **A (recommended)**:
  - **FL-20** Compression plan invariants — pure `planCompression(input)`.
  - **FL-21** Scheduling URL determinism — pure
    `buildMockBookingUrl(projectId, reviewerUserId)` returns the same URL for
    the same inputs.

---

## FD artifacts to generate

- [x] `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/functional-design/domain-entities.md`
- [x] `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/functional-design/business-rules.md`
- [x] `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/functional-design/business-logic-model.md`
- [x] `aidlc-docs/construction/unit-9-mobile-pwa-scheduling/functional-design/frontend-components.md`

## Code generation plan

See `aidlc-docs/construction/plans/unit-9-mobile-pwa-scheduling-code-generation-plan.md`.
