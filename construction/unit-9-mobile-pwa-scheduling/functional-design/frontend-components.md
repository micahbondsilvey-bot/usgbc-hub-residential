# Unit 9 — Frontend Components

Angular 20.2 PWA frontend slice for Unit 9 (Mobile/PWA & Scheduling).

---

## Folder layout

```
src/app/features/scheduling/
├── scheduling.store.ts             (signals: links, loading, error)
└── scheduling-button.component.ts  (Schedule call CTA)

src/app/shared/camera-capture/
└── camera-capture-button.component.ts

src/app/shared/image/
└── compression.ts                  (PURE — planCompression — FL-20)
```

PWA assets:
- `src/manifest.webmanifest`
- `src/service-worker.js`

---

## DTO additions (`src/app/core/api/dto.ts`)

```ts
export type SchedulingProviderKey = 'MS_BOOKINGS_MOCK';
export type SchedulingLinkStatus = 'CREATED' | 'CANCELLED';

export interface SchedulingLinkDto { ... }
export interface SchedulingLinksListDto { links: SchedulingLinkDto[]; }
export interface CreateSchedulingLinkDto {
  reviewId?: string;
  reviewerUserId?: string;
}
```

## ApiClient additions

```ts
createSchedulingLink(projectId: string, body: CreateSchedulingLinkDto):
  Observable<SchedulingLinkDto>;
listSchedulingLinks(projectId: string): Observable<SchedulingLinksListDto>;
```

---

## SchedulingStore

Signals (keyed by `projectId`):
- `linksByProject: Signal<Record<string, SchedulingLinkDto[]>>`
- `loadingByProject: Signal<Record<string, boolean>>`
- `errorByProject: Signal<Record<string, string | null>>`

Methods:
- `load(projectId)`
- `create(projectId, body): void` — POSTs, prepends to the list, opens the URL
  in a new tab.

---

## `scheduling-button.component`

Rendered on the Review page when the latest review is `RETURNED` (per US-7.5
sequencing). Single CTA "Schedule call with Green Rater" that opens the
booking URL in a new tab and persists the link.

Props:
- `@Input({ required: true }) projectId: string`
- `@Input() reviewId: string | null`
- `@Input() reviewerUserId: string | null`

`data-testid="scheduling-button"`.

---

## `camera-capture-button.component`

Renders a Material button labeled "Take photo" (with `photo_camera` icon).
On click, programmatically clicks a hidden
`<input type="file" accept="image/*" capture="environment">`. On change:

1. Reads `File`.
2. Loads dimensions via `new Image()` + `URL.createObjectURL`.
3. Calls pure `planCompression({ originalWidth, originalHeight, originalBytes })`.
4. Draws to `<canvas>` and `canvas.toBlob('image/jpeg', plan.qualityHint)`.
5. Emits `(captured)` with the compressed `File` (renamed
   `camera-capture-${Date.now()}.jpg`).

Props:
- `@Output() captured = new EventEmitter<File>()`
- `@Input() disabled = false`

`data-testid="camera-capture-button"`.

Hidden under `@media (min-width: 601px)` when the parent passes `mobileOnly`
input (defaults to false — visible on all sizes for accessibility).

---

## Host integration

### `CreditSubmittalsComponent`

Above the existing file input row, add:
```html
<gbci-camera-capture-button
  (captured)="onCameraCaptured($event)"
></gbci-camera-capture-button>
```

`onCameraCaptured(file)` calls the existing `uploadFile(file)` method.

### `ReviewPageComponent`

In the "returned" block, below the Accept/Continue buttons:
```html
<gbci-scheduling-button
  [projectId]="projectId"
  [reviewId]="returned.id"
  [reviewerUserId]="store.assignedReviewerId()"
></gbci-scheduling-button>
```

If `assignedReviewerId` is null, the service infers from the latest review's
membership.

### `AppComponent` shell

No new top-bar entry. The "Dashboard" link from U7 already covers GR
dashboard access.

---

## Responsive layout updates

`src/styles.scss` additions:

```scss
@media (max-width: 600px) {
  .gbci-button,
  button.mat-mdc-button-base,
  .mat-mdc-raised-button,
  .mat-mdc-stroked-button {
    min-height: 44px;
    font-size: 0.9375rem;
  }
  .gbci-page {
    padding: 12px !important;
  }
  table {
    font-size: 0.875rem;
  }
  .gbci-app-header {
    padding: 8px 12px;
  }
}
```

Plus per-page tweaks for workbook + dashboards (stacked cards, larger
input boxes) — applied via local component styles.

---

## PWA manifest (`src/manifest.webmanifest`)

```json
{
  "name": "GBCI Certify — LEED Residential",
  "short_name": "GBCI Certify",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1976d2",
  "background_color": "#ffffff",
  "icons": [
    { "src": "favicon.ico", "sizes": "64x64", "type": "image/x-icon" }
  ]
}
```

Referenced from `index.html` via
`<link rel="manifest" href="manifest.webmanifest">`.

---

## A11y checklist

- All new buttons retain visible focus rings (do not override Material's
  `:focus-visible`).
- Camera button has `aria-label="Capture photo from camera"` for screen
  readers.
- The mobile breakpoint maintains all keyboard interactivity (no touch-only
  patterns).
- Color contrast on the touch-target restyles meets WCAG AA.
