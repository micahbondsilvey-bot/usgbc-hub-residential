# Unit 8 — Frontend Components

Angular 20.2 PWA frontend slice for Unit 8 (Mocked AI). Follows the existing
`features/<unit>/` pattern with signal-backed stores. All new components are
standalone (the project-wide default).

---

## Folder layout

```
src/app/features/ai/
├── ai-runs.store.ts                 (signals: activeRun, runs, polling, ack/ignore)
├── ai-run-button.component.ts       (Run / Analyzing… / Re-run button)
├── ai-findings-panel.component.ts   (grouped findings + action buttons)
└── ai-findings.utils.ts             (UI helpers: severity colors, kind labels)
```

The store is the single source of truth; both components are dumb consumers
(`inject(AiRunsStore)`). The store handles polling via `setInterval(2000)` and
clears the timer on `COMPLETED|FAILED` and on `ngOnDestroy` of the host
component.

---

## DTO additions (`src/app/core/api/dto.ts`)

```ts
export type AiRunType = 'PRE_SUBMISSION' | 'PRE_REVIEW';
export type AiRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type AiFindingKind =
  | 'MISSING_EVIDENCE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CROSS_CREDIT_CONTRADICTION'
  | 'ATTENTION_FLAG';
export type AiFindingSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type AiFindingStatus = 'NEW' | 'ACKNOWLEDGED' | 'IGNORED';

export interface AiInsightFindingDto { ... }
export interface AiInsightRunDto { ... }
export interface AiInsightRunsListDto { ... }
```

(Mirrors the FD `domain-entities.md` shapes.)

---

## ApiClient additions (`src/app/core/api/api-client.ts`)

```ts
startAiRun(projectId: string, type: AiRunType): Observable<AiInsightRunDto>;
getAiRun(projectId: string, runId: string): Observable<AiInsightRunDto>;
listAiRuns(projectId: string, type?: AiRunType): Observable<AiInsightRunsListDto>;
acknowledgeAiFinding(projectId: string, runId: string, findingId: string):
  Observable<AiInsightFindingDto>;
ignoreAiFinding(projectId: string, runId: string, findingId: string):
  Observable<AiInsightFindingDto>;
```

---

## AiRunsStore

Signals:
- `activeRun: Signal<AiInsightRunDto | null>` — the run currently being polled.
- `runs: Signal<AiInsightRunDto[]>` — last 20 runs for the current (project, type).
- `loading: Signal<boolean>`
- `error: Signal<string | null>`

Methods:
- `loadRuns(projectId, type): void`
- `start(projectId, type): void` — POST, then begin polling.
- `acknowledge(projectId, runId, findingId): void` — optimistic update.
- `ignore(projectId, runId, findingId): void`
- `stopPolling(): void` — called on `ngOnDestroy` of host.

Polling impl: `setInterval(() => api.getAiRun(...).subscribe(...), 2000)`. On
`COMPLETED|FAILED`, `clearInterval` + final `loadRuns` to refresh history. Polling
is paused on `document.visibilityState === 'hidden'` (re-use the U7 pattern).

---

## `ai-run-button.component`

Standalone Material button (`<button mat-raised-button>`).

States rendered:
- **No active run** — "Run AI check" (icon `auto_awesome` from Material Icons).
- **Active run is `QUEUED` or `RUNNING`** — "Analyzing…" with `<mat-spinner
  diameter="18">`, button disabled.
- **Last run `COMPLETED` or `FAILED`** — "Re-run AI check".

Props:
- `@Input({ required: true }) projectId: string`
- `@Input({ required: true }) type: AiRunType`

The component reads from `AiRunsStore` and dispatches `store.start(projectId,
type)` on click. `data-testid="ai-run-button-<type>"`.

A11y: `aria-live="polite"` on the status pill so SR announces transitions; button
`aria-busy` mirrors the disabled state.

---

## `ai-findings-panel.component`

Renders `activeRun()?.findings` (and falls back to listing the latest COMPLETED
run from `runs()` if there's no active run).

Structure:
- A `<mat-card>` per severity group: HIGH (red strip), MEDIUM (amber), LOW
  (neutral).
- Within a group: `<mat-list>` with one item per finding.
  - Title (bold).
  - Credit code chip + kind chip.
  - Description (regular text).
  - "Suggested action" callout (italic, indented).
  - Action row: `Acknowledge` + `Ignore` buttons. Buttons are hidden when the
    finding's `status !== 'NEW'` and replaced with a status badge.
- Empty state: "No findings — looks good."
- Failed run state: red banner with `failureReason`.

Props:
- `@Input({ required: true }) projectId: string`
- `@Input({ required: true }) runIdOrType: { type: 'run'; id: string } | { type:
  'auto'; runType: AiRunType }` — `auto` uses the active run.

`data-testid`s:
- `ai-findings-group-<severity>`
- `ai-finding-<findingId>`
- `ai-finding-<findingId>-ack-button` / `-ignore-button`

---

## Host integration

### `WorkbookPageComponent`

A new header row above the tabs:
```html
<header class="wb-ai-row">
  <gbci-ai-run-button [projectId]="projectId()" type="PRE_SUBMISSION" />
  <gbci-ai-findings-panel
    [projectId]="projectId()"
    [runIdOrType]="{ type: 'auto', runType: 'PRE_SUBMISSION' }" />
</header>
```

RBAC: shown to users with `GREEN_RATER` / `PROJECT_TEAM` / `ADMIN` membership.

### `ReviewPageComponent`

A new section below the review header:
```html
<section class="rv-ai-section">
  <h3>Reviewer AI pre-review</h3>
  <gbci-ai-run-button [projectId]="projectId()" type="PRE_REVIEW" />
  <gbci-ai-findings-panel
    [projectId]="projectId()"
    [runIdOrType]="{ type: 'auto', runType: 'PRE_REVIEW' }" />
</section>
```

RBAC: shown to users with `REVIEWER` / `ADMIN` membership.

---

## Routes

No new top-level routes. The AI surfaces live inside Workbook and Review pages.

---

## Bundle estimate

- `features/ai/` total raw ≤ 25 kB (no new heavy dependencies; Material chips,
  spinners, cards are already in the bundle).
- Added to `WorkbookPageComponent` and `ReviewPageComponent` lazy chunks (delta
  ≤ 5 kB each in development).

---

## A11y checklist

- Live regions on the run status pill (`aria-live="polite"`).
- Each finding action button has an accessible name via `mat-button` content.
- Severity icons use `aria-hidden="true"`; the textual label "HIGH" / "MEDIUM" /
  "LOW" remains screen-reader visible.
- Color is never the sole indicator of severity (icon + text label).
