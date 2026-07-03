# Unit 6 — Frontend Components

Angular 20.2 standalone + Signals + feature-lazy convention (carried forward from U1..U5). All
new code lands in `usgbc-hub-residential-fe/src/app/features/portfolio/` plus small extensions
to `core/api/dto.ts` + `core/api/api-client.ts` and the project-detail page in
`features/projects/`.

Decisions reflected (all-A from `unit-6-portfolio-design-plan.md`):
- Q9=A new `features/portfolio/` lazy feature with portfolio-page + dialogs.
- Q3=A portfolio dashboard at `/projects/:anchorId/portfolio`.
- Q4/Q5=A batch-submit & pay-and-submit dialogs render the orchestrator response.

---

## DTO additions (`core/api/dto.ts`)

```ts
// U6 — portfolio shapes.
export interface ProjectSummaryDto {
  // existing ProjectDto fields plus...
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;
  attemptedTotal: number;
  awardedTotal: number;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
    outcome: ReviewOutcome | null;
    submittedAt: string;
    returnedAt: string | null;
  } | null;
}

export interface PortfolioDashboardDto {
  anchor: ProjectSummaryDto;
  children: ProjectSummaryDto[];
  rollup: {
    totalChildren: number;
    byStatus: Record<ProjectStatus, number>;
    byCertificationLevel: Record<string, number>;
    attemptedTotal: number;
    awardedTotal: number;
  };
}

export interface PortfolioFeeQuoteLineItemDto {
  projectId: string;
  displayProjectId: string | null;
  registrationFeeCents: number;
  reviewFeeCents: number;
  totalCents: number;
  warnings: { reason: string }[];
}

export interface PortfolioFeeQuoteDto {
  anchorProjectId: string;
  phase: ReviewPhase;
  lineItems: PortfolioFeeQuoteLineItemDto[];
  totals: {
    registrationFeeCents: number;
    reviewFeeCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  };
  warnings: { reason: string }[];
}

export type ChildSubmitOutcomeDto =
  | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
  | { projectId: string; displayProjectId: string | null; status: 'SKIPPED_INELIGIBLE'; reason: string }
  | { projectId: string; displayProjectId: string | null; status: 'FAILED'; error: { code: string; message: string } };

export type AnchorSubmitOutcomeDto =
  | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
  | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_INELIGIBLE'; reason: string }
  | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_FAILED'; error: { code: string; message: string } };

export interface BatchSubmitResultDto {
  anchor: AnchorSubmitOutcomeDto;
  children: ChildSubmitOutcomeDto[];
  summary: { submittedCount: number; skippedCount: number; failedCount: number };
}

export interface PatchAnchorDto {
  isPortfolioAnchor: boolean;
}

export interface PatchParentAnchorDto {
  parentAnchorId: string | null;
}
```

---

## ApiClient additions (`core/api/api-client.ts`)

```ts
patchAnchor(projectId: string, body: PatchAnchorDto): Observable<ProjectDto>;
patchParentAnchor(projectId: string, body: PatchParentAnchorDto): Observable<ProjectDto>;

getPortfolioDashboard(anchorId: string): Observable<PortfolioDashboardDto>;
getPortfolioFeeQuote(anchorId: string, phase: ReviewPhase): Observable<PortfolioFeeQuoteDto>;

submitPortfolio(anchorId: string, body: { phase: ReviewPhase }): Observable<BatchSubmitResultDto>;
payAndSubmitPortfolio(anchorId: string, body: { phase: ReviewPhase; paymentMethod?: 'mock' }): Observable<BatchSubmitResultDto>;
```

`submitPortfolio` and `payAndSubmitPortfolio` accept HTTP errors with body
`{ code: 'ANCHOR_INELIGIBLE' | 'ANCHOR_FAILED', result: BatchSubmitResultDto }` and surface the
`result` to the UI for the cascade-error display.

---

## Components

All components are standalone, use Angular Material 20.x, and consume the shared `ApiClient`
through DI.

### `portfolio-page.component`
- Route: `/projects/:anchorId/portfolio` (lazy via `loadComponent`).
- Layout:
  - Top card — anchor summary (display ID, name, status chip, attempted/awarded, target +
    achieved certification level).
  - Right-side action panel — "Pay & submit portfolio", "Add child", "Open in detail".
  - Material table — children list with columns: display ID, name, status, certification level
    (achieved / target), attempted, awarded, latest review status, actions ("open", "detach").
  - Rollup band — totals across portfolio (attempted, awarded, byStatus chips,
    byCertificationLevel chips).
- State: `portfolioStore` signal-based store loads via `getPortfolioDashboard(anchorId)`.
- A11y: WCAG 2.1 AA — table has caption, action buttons have accessible names, status chips
  use both color + text.

### `portfolio.store`
- Injectable signal store managing:
  - `dashboard: signal<PortfolioDashboardDto | null>`
  - `loading: signal<boolean>`
  - `error: signal<string | null>`
  - `lastBatchResult: signal<BatchSubmitResultDto | null>`  (sticky after submit)
- Methods: `load(anchorId)`, `refresh()`, `submitBatch(anchorId, phase)`,
  `payAndSubmit(anchorId, phase)`, `clearBatchResult()`.

### `designate-anchor.dialog.component`
- Opened from the existing project-detail page (Project Information section gains a
  "Portfolio" sub-section).
- Two-mode dialog:
  - **Anchor mode** — toggle "Make this project a portfolio anchor". When toggling off and
    children remain → disabled with helper text "detach children first". When project has a
    non-null `parentAnchorId` → toggle disabled with helper text "detach from parent first".
  - **Attach mode** — searchable project picker (autocomplete fed by
    `apiClient.listProjects({ isPortfolioAnchor: true })` — a small extension to the existing
    list endpoint with this filter). Excludes self and already-attached projects. On confirm
    calls `patchParentAnchor`.
- Errors map: `409 ANCHOR_HAS_CHILDREN` → "Detach all children before un-anchoring";
  `409 ANCHOR_HAS_PARENT` → "This project is attached to a portfolio. Detach first.";
  `409 PORTFOLIO_BUSY` → "Portfolio has an active review. Try again later.";
  `409 HIERARCHY_*` → mapped to plain language.

### `batch-submit.dialog.component`
- Opened from `portfolio-page.component` "Pay & submit portfolio" button.
- Steps:
  1. Phase picker (`PRELIMINARY` / `FINAL` / `SUPPLEMENTAL`). Default per portfolio history
     (latest unfinished phase across children, or `PRELIMINARY` if none).
  2. **Eligibility preview** — calls `apiClient.getPortfolioFeeQuote(...)` for the price
     totals AND a hidden lightweight call to `apiClient.submitPortfolio` is NOT invoked at this
     step (we don't want side effects on a preview). Instead, the dashboard shows per-project
     status chips: "Eligible" / "Ineligible (reason)" / "Already in review". Inferred client-
     side from the dashboard's `latestReview.status` and `Project.status`. Forward-compat seam:
     a future `GET /portfolio/dry-run` endpoint can populate this exactly.
  3. **Fee preview** — line items per project + totals. In this build, totals will typically
     be $0 (registration paid; review fees deferred). When >0 → CTA changes to "Pay & submit"
     with a clear note "Combined billing not implemented in this build" disabling the button.
  4. **Confirm** — calls `payAndSubmitPortfolio` (which falls back to `submitPortfolio` server-
     side when total is $0).
- After the call resolves: the dialog renders the `BatchSubmitResultDto`:
  - Anchor row at the top.
  - One row per child outcome.
  - Color coding: SUBMITTED green, SKIPPED_INELIGIBLE neutral with reason chip, FAILED red.
  - When anchor failed/ineligible → all children rows show "Skipped — anchor failed" with a
    callout banner explaining the cascade.
- After dismiss: dialog refreshes the dashboard.

### `report-summary.component`
- (Reused from U5; not new.) Linked from each child row's "latest review" cell when present.

### Project-detail page extensions (`features/projects/project-detail-page.component`)
- Adds a **"Portfolio"** section:
  - When `project.isPortfolioAnchor === true` → button "Open portfolio dashboard" → routes to
    `/projects/:projectId/portfolio`.
  - When `project.parentAnchorId !== null` → label "Member of portfolio: <anchor displayId>"
    with router-link to the anchor's portfolio dashboard.
  - When neither → "Designate as portfolio anchor" + "Attach to a portfolio" buttons →
    `designate-anchor.dialog.component`.

### Routes
- `app.routes.ts` gets one new lazy entry:
  ```ts
  {
    path: 'projects/:anchorId/portfolio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/portfolio/portfolio-page.component').then(m => m.PortfolioPageComponent),
  }
  ```
- Existing project-detail route is unchanged.

---

## Permissions in the UI (mirrors backend RBAC)

| UI element | Visible / enabled when | Action |
|---|---|---|
| "Designate as anchor" button | Caller has PT/GR membership on the project OR Admin | Opens designate-anchor.dialog |
| "Attach to portfolio" button | Caller has PT/GR membership on the project OR Admin | Opens designate-anchor.dialog (attach mode) |
| "Open portfolio dashboard" button | Caller has any membership on the anchor OR Admin | Routes |
| "Pay & submit portfolio" button | Caller has PT/GR membership on the anchor OR Admin | Opens batch-submit.dialog |
| "Detach" action on a child row | Caller has PT/GR membership on the **child** OR Admin | Calls `patchParentAnchor(child, null)` |

Visibility derived from existing `authStore.permissionsForProject(projectId)` selectors that
the project-detail page already consumes; no new auth shape.

---

## Mocked-AI / notifications integration

- No AI involvement in U6.
- Notifications: U5's `NotificationGateway.send` is fired by the U5 `SubmissionOrchestrator`
  per submitted project (one notification per child). U6 itself does not send portfolio-level
  notifications this build (that's the U7 framework's job).

---

## A11y checklist (WCAG 2.1 AA, NFR-7.5)

- Color is never the only signal: every status chip pairs color + textual label.
- Tables include `<caption>` and `scope` attributes on header cells.
- Dialogs are keyboard-trapped and have descriptive `aria-labelledby` titles.
- Action buttons announce their target ("Pay and submit portfolio" rather than "Submit").
- Forms use Material's built-in label association; error messages have `aria-live="polite"`.

---

## Loading / error states

- Skeletons: portfolio-page shows a 3-row Material skeleton while `dashboard()` is null.
- Error: a single `<usgbc-empty-state>` with the error message + "Retry" button.
- Concurrency: when a batch-submit returns with mixed outcomes, the dashboard auto-refreshes
  before showing the result dialog (so the table reflects new statuses).

---

## Bundle impact estimate

New lazy chunk `portfolio-page-component`: ~40-60 kB raw / 12-18 kB gzip (Material table +
two dialog components + signals store). Will be confirmed during code generation.
