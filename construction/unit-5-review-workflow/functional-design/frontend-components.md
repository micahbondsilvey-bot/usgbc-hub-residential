# Unit 5 — Frontend Components

Angular 20.2 standalone components, lazy-loaded, Signals-backed. Q8=A reviewer assignment via
existing membership; this unit ships only the in-flight review surfaces (reviewer + accept).
The U7 dashboards consume the same data.

---

## Routes (added to `app.routes.ts`)

| Path | Auth | Component |
|---|---|---|
| `/projects/:projectId/review` | `authGuard` | `ReviewPageComponent` (router-tabs Reviewer / Outcome) |

The single route renders both the reviewer-side (per-credit awarded inputs + confirm + return)
AND the team-side (read-only outcome + accept-or-continue). The component picks the variant
from the actor's role + the project's current state.

The U3 project-detail page adds a "Review" link/button next to "Workbook" (visibility gated by
role + project status).

---

## `features/review/` (new feature folder)

```
features/review/
├── review.store.ts                           // Signals — reviews list, current review, mutations
├── review-page.component.ts                  // Top-level page; renders reviewer or team variant
├── reviewer-panel/
│   ├── reviewer-panel.component.ts           // Per-credit awarded inputs + "Award all verified" + confirm
│   └── credit-decision-row.component.ts       // Single row: name, attempted/verified, awarded input, comment
├── outcome-panel/
│   └── outcome-panel.component.ts            // Read-only outcome + accept / continue actions
├── submit-dialog/
│   └── submit-for-review.dialog.component.ts  // Phase-picker + fee-confirmation step
├── report-viewer/
│   └── report-viewer.component.ts            // Renders Review.reportMarkdown
└── quality-score/
    └── quality-score-card.component.ts       // Reviewer / Admin entry; Green Rater / others read-only
```

### `ReviewStore` (Signals)
- `state: signal({ reviews: ReviewDto[], currentReview: ReviewDto | null, qualityScore:
  SubmittalQualityScoreDto | null, submitting, error })`.
- Computed: `latestReturned`, `inFlight` (status ∈ SUBMITTED | DECIDED | CONFIRMED),
  `canSubmitFinal` (latestReturnedPrelim with PASSED|PASSED_WITH_ISSUES outcome).
- Actions:
  - `loadReviews(projectId)`
  - `submitForReview(phase: ReviewPhase)` → opens dialog; calls `apiClient.submitForReview(...)`.
  - `setAwarded(creditId, awardedPoints)` → calls existing scorecard `setPoints` endpoint with
    `{ awardedPoints }`. Refreshes the scorecard signal in the U2 store.
  - `awardAllVerified(reviewId)`.
  - `confirm(reviewId, outcome?)`.
  - `returnReview(reviewId)`.
  - `accept()` / `continueToNextPhase()`.
  - `saveQualityScore(reviewId, score, notes)`.

### `ReviewPageComponent` (variant routing)
```text
<header>Review · <project.displayName>  [<phase chip>]</header>

  if no in-flight review:
    if user is PT/GR: show "Submit for review" CTA (opens submit dialog)
    if user is Reviewer: read-only "no in-flight review"
    if user is Admin: show both
  else:
    if user is Reviewer or Admin AND review.status ∈ SUBMITTED|DECIDED|CONFIRMED:
      <gbci-reviewer-panel [review]="review" />
    if review.status === RETURNED:
      <gbci-outcome-panel [review]="review" />
      <gbci-report-viewer [markdown]="review.reportMarkdown" />
      if user is PT/GR/Admin and outcome ∈ PASSED|PASSED_WITH_ISSUES: "Accept" CTA
      if outcome === PASSED_WITH_ISSUES: "Continue to next phase" CTA
```

### `ReviewerPanelComponent`
- Material table over the project scorecard joined to credit metadata.
- Columns: Credit, Attempted, Verified, **Awarded** (inline editable integer with
  `min=0 max=verifiedPoints`), Reviewer comment (links to U4 notes section), Action.
- Toolbar:
  - "Award all verified" button (only enabled when status ∈ SUBMITTED|DECIDED).
  - "Confirm review" button → opens a small dialog asking for `outcome` override (optional)
    + `reportNotes` (optional). On confirm, calls `confirm(reviewId, ...)` and the panel
    flips to a "Confirmed — review the report" view with a "Return" CTA.
  - "Return to Green Rater" button (enabled when CONFIRMED). Asks for confirmation.

### `OutcomePanelComponent`
- Big card with the certification level + outcome chip + key dates.
- Per-credit table (read-only) showing awarded vs verified.
- Action row: Accept / Continue to next phase (visibility gated by role).

### `ReportViewerComponent`
- Pure renderer for `review.reportMarkdown`. Uses `marked` (already a transitive Angular Material
  dep — confirm at code-gen time; if not available, uses a small custom renderer).

### `SubmitForReviewDialog`
- Mat dialog: phase selection (PRELIMINARY / FINAL / SUPPLEMENTAL), fee confirmation note (text
  only — no real charge), agreement-style checkbox ("I confirm the workbook is ready for
  review"), Submit button.

### `QualityScoreCard`
- Material card embedded in the reviewer panel (CONFIRMED | RETURNED) and the outcome panel
  (RETURNED).
- Reviewer / Admin: editable score (0..5) + notes. Save calls `apiClient.saveQualityScore(...)`.
- Other roles: read-only display.

---

## Store interactions with U2 scorecard store

The U2 `ScorecardStore.setPoints` endpoint already supports the `awardedPoints` field. The
backend (BR-RD2) extends the writers list to include `Reviewer`. The reviewer-panel calls
`scorecardStore.setPoints(creditId, { awardedPoints })`; on success the U2 store refreshes
the entry. The `ReviewStore` subscribes to scorecard updates so its derived state (per-credit
displayed awarded value) stays in sync.

---

## Shared types extensions (`core/api/dto.ts`)

```ts
export type ReviewPhase = 'PRELIMINARY' | 'FINAL' | 'SUPPLEMENTAL';
export type ReviewStatus = 'OPEN' | 'SUBMITTED' | 'DECIDED' | 'CONFIRMED' | 'RETURNED';
export type ReviewOutcome = 'PASSED' | 'PASSED_WITH_ISSUES' | 'DENIED';

export interface ReviewDto {
  id: string;
  displayId: string;
  projectId: string;
  phase: ReviewPhase;
  status: ReviewStatus;
  outcome: ReviewOutcome | null;
  submittedByUserId: string | null;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  decidedAt: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  returnedByUserId: string | null;
  returnedAt: string | null;
  awardedTotal: number | null;
  certificationLevel: string | null;
  reportMarkdown: string | null;
  reportGeneratedAt: string | null;
  version: number;
}

export interface SubmitForReviewDto {
  phase: ReviewPhase;
}

export interface ConfirmReviewDto {
  outcome?: ReviewOutcome;
  reportNotes?: string;
}

export interface AwardAllVerifiedResponseDto {
  updatedCount: number;
  awardedTotal: number;
  certificationLevel: string | null;
}

export interface SubmittalQualityScoreDto {
  id: string;
  projectId: string;
  reviewId: string;
  score: number;
  notes: string | null;
  enteredByUserId: string;
  enteredAt: string;
  version: number;
}

export interface AssignReviewerDto {
  userId: string;
}
```

---

## API client extensions

```ts
listReviews(projectId: string): Observable<ReviewDto[]>;
getReview(projectId: string, reviewId: string): Observable<ReviewDto>;
submitForReview(projectId: string, body: SubmitForReviewDto): Observable<ReviewDto>;
awardAllVerified(projectId: string, reviewId: string): Observable<AwardAllVerifiedResponseDto>;
confirmReview(projectId: string, reviewId: string, body: ConfirmReviewDto): Observable<ReviewDto>;
returnReview(projectId: string, reviewId: string): Observable<ReviewDto>;
acceptCertification(projectId: string): Observable<ProjectDto>;
continueToNextPhase(projectId: string): Observable<void>;
saveQualityScore(projectId: string, reviewId: string, score: number, notes?: string): Observable<SubmittalQualityScoreDto>;
listQualityScores(projectId: string): Observable<SubmittalQualityScoreDto[]>;
assignReviewer(projectId: string, userId: string): Observable<void>;
```

---

## Accessibility (WCAG 2.1 AA carry-over)

- Per-credit awarded input is a real `<input type="number">` with explicit `min`/`max`/`step`
  attributes; the help-tooltip explains the `awarded ≤ verified` rule.
- "Award all verified" / "Confirm" / "Return" / "Accept" buttons have explicit labels and
  confirmation dialogs (irrevocable transitions).
- The report viewer uses semantic Markdown rendering (real `<table>`/`<h2>` elements, not
  divs), supporting screen-reader navigation.
