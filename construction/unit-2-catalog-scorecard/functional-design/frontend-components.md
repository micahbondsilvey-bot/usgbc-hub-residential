# Unit 2 — Frontend Components (Angular 20.2 PWA)

Frontend slice for Unit 2: scorecard tree with point entry, live summary bar, view-tab filter
(other tabs disabled-with-tooltip per Q7=A), expandable project-info panel, and a Signal-based
feature store (Q11=A).

## Component Hierarchy

```
src/app/
└── features/scorecard/
    ├── scorecard.routes.ts
    ├── scorecard.store.ts                     (Signals; per-project state + computed totals)
    ├── scorecard-summary.calc.ts              (pure FE re-implementation of backend calculator; Q6=A)
    ├── scorecard-page/
    │   └── scorecard-page.component.ts        (ScorecardPage — top-level layout)
    ├── components/
    │   ├── scorecard-summary-bar/
    │   │   └── scorecard-summary-bar.component.ts
    │   ├── scorecard-view-tabs/
    │   │   └── scorecard-view-tabs.component.ts        (Q7=A — All enabled; others disabled w/ tooltip)
    │   ├── project-info-panel/
    │   │   └── project-info-panel.component.ts
    │   ├── category-row/
    │   │   └── category-row.component.ts
    │   ├── credit-row/
    │   │   └── credit-row.component.ts
    │   ├── point-cell/
    │   │   └── point-cell.component.ts                 (inline integer editor with warnings)
    │   └── attempted-toggle/
    │       └── attempted-toggle.component.ts           (locked-on for prerequisites)
    └── api/
        └── scorecard-api.client.ts            (extension of core ApiClient)
```

`features/scorecard/scorecard.routes.ts` exports a lazy-loaded route at
`/projects/:projectId/scorecard`, gated by `authGuard` and `projectRoleGuard` with
`data: { allowedProjectRoles: ['*'] }` so any active member or Admin can view.

## Components — Props, State, Interactions

### `ScorecardPage` (top-level)
- **Inputs**: `projectId` (route param via `withComponentInputBinding`).
- **State (delegated)**: pulls from `ScorecardStore`.
- **On init**: `store.loadFor(projectId)` → fetches catalog + scorecard concurrently.
- **Layout**: `<gbci-scorecard-summary-bar>` at top, `<gbci-scorecard-view-tabs>`,
  `<gbci-project-info-panel>` (expandable), then the credit tree.
- **A11y**: `aria-busy="true"` while loading; `role="status"` on the summary bar.

### `ScorecardSummaryBar`
- **Inputs**: `summary: Signal<ScorecardSummary>` (from store).
- **Renders**: Attempted / Verified / Awarded / Available + the derived certification level chip.
- **Update mode**: a Signal `computed()` so the bar re-renders only when the summary changes.
- **Mobile**: stacks vertically below 480px.

### `ScorecardViewTabs` (Q7=A)
- Tabs: `All` (active), `Field Verification`, `Submittals`, `Verification Notes`.
- Tabs other than `All` are disabled with `matTooltip="Available after Unit 4 — Workbook"` and
  `aria-disabled="true"`. Selecting `All` is a no-op.
- Emits the active tab via output for future units.

### `ProjectInfoPanel`
- **Inputs**: `projectId`.
- **State**: `expanded: signal(false)`.
- **Renders**: expandable panel with editable fields (placeholder until Unit 3 ships). For U2 it
  shows `projectId`, `gbciId` (`RES-DEMO-001` for the demo project), `ratingSystem.name`, and
  the current overall summary echo. Editing is disabled in U2.

### `CategoryRow`
- **Inputs**: `category: CategoryView` (catalog row + per-category totals).
- **State**: `expanded: signal(true)` for the demo (collapsed by default would also be acceptable
  — defaulting to expanded helps the demo).
- **Renders**: category icon + title + per-category totals + the list of credits when expanded.

### `CreditRow`
- **Inputs**: `creditView: CreditView` (catalog credit + entry + warnings for that credit).
- **State**: nothing local — all writes go through the store.
- **Renders**: credit title, intent (truncated; expandable), prereq badge or attempted toggle,
  three `<gbci-point-cell>` cells (Attempted / Verified / Awarded), and any warnings inline.
- **Permissions**: each `<gbci-point-cell>` shows as read-only when the user lacks the column's
  write permission (per BR-S2). The store carries `me.role` and `me.isAdmin`.

### `AttemptedToggle`
- **Inputs**: `creditId`, `attempted: boolean`, `kind: 'prerequisite'|'credit'`.
- **Renders**: a `mat-slide-toggle` that is **disabled (locked-on)** for prereqs (per Q3.2.3 from
  requirements: no separate lock icon — the toggle itself is locked on).
- **Interaction**:
  - Toggle off (optional credits): opens a confirmation dialog "Clear entered points for this
    credit?" before calling `store.unattempt(creditId)`.
  - Toggle on: calls `store.attempt(creditId)`.
- **`data-testid`**: `scorecard-attempted-toggle-${creditSlug}`.

### `PointCell`
- **Inputs**: `creditId`, `column: 'attempted'|'verified'|'awarded'`, `value: number`,
  `warnings: Warning[]`, `editable: boolean`.
- **State**: `draft: signal(value)` while editing; `dirty: computed(...)`.
- **Validation**: must be a non-negative integer.
- **Out-of-range** values save successfully but render with a `data-warning="true"` style and
  surface the warning text via `aria-describedby`.
- **Save trigger**: blur or Enter; debounced 200ms via `debounceTime` if the user is typing.
- **`data-testid`**: `scorecard-point-cell-${column}-${creditSlug}`.

## State Management — `ScorecardStore` (Q11=A)

Signal-based feature store; persisted to `sessionStorage` keyed by `projectId` so a refresh
doesn't lose the in-memory cache (re-validated against backend on resume).

### Signals
- `projectId = signal<string | null>(null)`
- `loading = signal<boolean>(false)`
- `catalog = signal<CatalogTree | null>(null)`
- `entries = signal<Map<string, ScorecardEntryDto>>(new Map())` (keyed by `creditId`)
- `meRole = signal<{ role: ProjectRole | null; isAdmin: boolean }>({ role: null, isAdmin: false })`
- `pendingWrites = signal<Set<string>>(new Set())` (creditIds currently in-flight)
- `errorMessage = signal<string | null>(null)`

### Computed
- `summary = computed(() => calc.compute(Array.from(entries().values()), catalog()))`
- `view = computed(() => buildTreeView(catalog(), entries(), summary()))`
- `warnings = computed(() => collectWarnings(view()))`

### Actions
- `loadFor(projectId)` — fetches catalog + scorecard + me-role concurrently; updates Signals.
- `attempt(creditId)` / `unattempt(creditId)` — call backend then update local map.
- `setPoint(creditId, column, value)` — debounced save; optimistic update with rollback on error.
- `refreshSummary()` — pulls authoritative summary (`GET .../summary`) when needed (e.g., after a
  reviewer's edits in Unit 5 land).

## Form Validation Rules
- Point cells: integer, `>= 0`. Empty = `0`.
- Out-of-range warnings: rendered inline via `aria-describedby` + a `<gbci-banner>` icon next to
  the cell.

## API Endpoints Used
| Component | Method | Path |
|---|---|---|
| ScorecardStore.loadFor | GET | `/api/v1/catalog/rating-systems/:id` |
| ScorecardStore.loadFor | GET | `/api/v1/projects/:projectId/scorecard` |
| ScorecardStore.attempt / unattempt | POST/PUT | `/api/v1/projects/:projectId/scorecard/:creditId(/un-attempt)` |
| ScorecardStore.setPoint | PUT | `/api/v1/projects/:projectId/scorecard/:creditId` |
| ScorecardStore.refreshSummary | GET | `/api/v1/projects/:projectId/scorecard/summary` |

## Accessibility & Mobile
- Every interactive element has `data-testid` and visible focus.
- Tree expansion uses `aria-expanded` and `aria-controls`.
- Point cells expose `role="spinbutton"` semantics via the underlying input (`type="number"`).
- Layout collapses at < 768px to a single-column mobile view; per-credit rows wrap their controls
  beneath the title.

## PBT Notes (frontend)
- `scorecard-summary.calc.ts` is the FE mirror of the backend `ScorecardSummaryCalculator`. The
  same properties from `business-logic-model.md` (BL-7) apply. Tests are deferred per the
  documented Unit 1 PBT deviation.
