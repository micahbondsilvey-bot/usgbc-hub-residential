# Unit 9 — Domain Entities

Tech-agnostic domain model for the Mobile/PWA & Scheduling unit. **One new
table** — `scheduling_link` — plus pure value types for the mock scheduling
provider and the client-side image-compression planning step.

Decisions reflected (all-A from `unit-9-mobile-pwa-scheduling-design-plan.md`):
- Q3=A `SchedulingProvider` seam + `MockMsBookingsProvider` impl.
- Q4=A new `scheduling_link` table.

---

## SchedulingLink

One row per booking link created for a project.

- `id: UUID` (PK).
- `projectId: UUID` — soft FK to `project.id`.
- `reviewId: UUID | null` — nullable; non-null when the link was created
  against a specific review.
- `createdByUserId: UUID` — actor at creation time.
- `providerKey: SchedulingProviderKey` enum — `MS_BOOKINGS_MOCK` only in this
  build.
- `externalRef: text | null` — opaque reference token from the provider
  (mocked: `${projectId}-${reviewerUserId}-${Date.now()}`).
- `bookingUrl: text` — clickable URL (mocked).
- `reviewerUserId: UUID | null` — the reviewer the booking is scheduled with.
- `status: SchedulingLinkStatus` enum — `CREATED | CANCELLED`.
- `version: int` — LWW.
- inherits `AuditBase`.

Indexes:
- `scheduling_link_project_idx` on `(projectId, createdAt DESC)`.

---

## SchedulingProviderKey / SchedulingLinkStatus

```ts
export enum SchedulingProviderKey {
  MS_BOOKINGS_MOCK = 'MS_BOOKINGS_MOCK',
}

export enum SchedulingLinkStatus {
  CREATED = 'CREATED',
  CANCELLED = 'CANCELLED',
}
```

---

## SchedulingProvider seam

```ts
export const SCHEDULING_PROVIDER = 'SCHEDULING_PROVIDER';

export interface SchedulingProviderCreateInput {
  projectId: string;
  reviewId: string | null;
  reviewerUserId: string | null;
  createdByUserId: string;
}

export interface SchedulingProviderCreateResult {
  providerKey: SchedulingProviderKey;
  externalRef: string;
  bookingUrl: string;
}

export interface SchedulingProvider {
  create(input: SchedulingProviderCreateInput): Promise<SchedulingProviderCreateResult>;
}
```

`MockMsBookingsProvider.create(...)` is deterministic for fixed inputs (see
FL-21).

---

## SchedulingLinkDto (wire shape)

```ts
export interface SchedulingLinkDto {
  id: string;
  projectId: string;
  reviewId: string | null;
  reviewerUserId: string | null;
  providerKey: SchedulingProviderKey;
  externalRef: string | null;
  bookingUrl: string;
  status: SchedulingLinkStatus;
  createdByUserId: string;
  createdAt: string;
  version: number;
}

export interface SchedulingLinksListDto {
  links: SchedulingLinkDto[];
}

export interface CreateSchedulingLinkDto {
  reviewId?: string;
  reviewerUserId?: string;
}
```

---

## CompressionPlan (FE-only, pure)

```ts
export interface CompressionPlanInput {
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
}

export interface CompressionPlan {
  targetWidth: number;
  targetHeight: number;
  qualityHint: number; // 0.7..0.95
}
```

`planCompression(input): CompressionPlan` is the **FL-20** PBT-01 subject.
- `min(targetWidth, targetHeight) <= min(originalWidth, originalHeight)`
- `max(targetWidth, targetHeight) <= MAX_DIM (1600)`
- Aspect ratio preserved within ±1px.

The canvas re-encoding step is **not** pure (browser-dependent), but the
planning step is.

---

## Forward-compat (NOT implemented this build)

- **Real MS Bookings API** behind `SCHEDULING_PROVIDER`. The schema is
  channel-agnostic; the swap is a single `useClass` binding change.
- **Cancellation flow**. The schema reserves `status = CANCELLED` for future
  use; no endpoint ships in this build.
- **Per-organization Bookings calendar selection**. The mock URL is per-(project,
  reviewer).
- **Service-worker offline writes**. Static assets cache; API mutations don't.

## Sequences / DDL

No new sequences. The `scheduling_link` table uses `@PrimaryGeneratedColumn('uuid')`.
One index added in the entity decorator.
