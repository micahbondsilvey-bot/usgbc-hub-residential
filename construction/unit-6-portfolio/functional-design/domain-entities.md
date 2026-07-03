# Unit 6 — Domain Entities

Tech-agnostic domain model for the Portfolio unit. **No new tables.** U6 extends the existing
`Project` entity (U3) with two columns that encode the portfolio hierarchy and adds three new
DTO shapes for the API. All persisted columns inherit `AuditBase` from Unit 1 and continue to
participate in the U2 last-write-wins versioning contract.

Decisions reflected (all-A from `unit-6-portfolio-design-plan.md`):
- Q1=A extend `projects` with `is_portfolio_anchor` + reuse existing `parent_anchor_id`.
- Q4=A `BatchSubmitResult` DTO emitted by the orchestrator.
- Q3=A `PortfolioDashboard` DTO returned by the read endpoint.
- Q5=A `PortfolioFeeQuote` DTO returned by the quote endpoint.

---

## Project (extended)

The U3 `project` row is the anchor of the portfolio domain. U6 adds the **anchor flag**; the
**parent-anchor pointer** column already exists (it was forward-declared in U3). All other
fields are unchanged.

Existing column (U3):
- `parent_anchor_id: uuid | null` — self-referencing FK to `project.id`. NULL ⇒ standalone /
  anchor-self. Non-NULL ⇒ child of the referenced anchor.

New column (U6):
- `is_portfolio_anchor: boolean NOT NULL DEFAULT false` — true when this project has been
  designated as a portfolio anchor (per US-5.1).

Constraints / invariants enforced by **DB DDL** (added to the existing `RegistrationDdlBootstrapper`):
- FK `project_parent_anchor_fk`: `parent_anchor_id` references `project.id` `ON DELETE
  RESTRICT` (no cascade — explicit detach is required).
- CHECK `project_no_self_parent_chk`: `parent_anchor_id != id` (no self-parenting).
- CHECK `project_anchor_no_parent_chk`: a project cannot be both an anchor AND attached to a
  parent. SQL: `NOT (is_portfolio_anchor = true AND parent_anchor_id IS NOT NULL)`. This
  enforces depth = 1 at the database level.
- INDEX `project_parent_anchor_idx`: `(parent_anchor_id) WHERE parent_anchor_id IS NOT NULL`
  to make the dashboard children-lookup query a single-index scan.

Application-level invariants (enforced in `PortfolioService` + `HierarchyInvariant`, double-checked
by the DB CHECK constraints above):
- **FL-12 hierarchy invariant** — for any persisted project `p` with `p.parent_anchor_id != null`,
  the referenced row must satisfy `is_portfolio_anchor = true AND parent_anchor_id IS NULL`.
  Anchors are roots; children attach directly; no chains. Implemented as a pure function
  `assertHierarchy(project, candidateAnchor)` in
  `src/portfolio/state-machine/hierarchy.invariant.ts` — no Nest imports, PBT-01 friendly.

---

## BatchSubmitResult (DTO)

The shape returned by `POST /projects/:anchorId/portfolio/submit` (and the inner result of
`pay-and-submit`).

```ts
type ChildSubmitOutcome =
  | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
  | { projectId: string; displayProjectId: string | null; status: 'SKIPPED_INELIGIBLE'; reason: SkipReason }
  | { projectId: string; displayProjectId: string | null; status: 'FAILED'; error: { code: string; message: string } };

type SkipReason =
  | 'NO_MEMBERSHIP'        // caller lacks PT/GR membership on the child (Q6)
  | 'WRONG_PROJECT_STATUS' // child not in REGISTERED
  | 'NO_ATTEMPTED_CREDIT'  // child has 0 attempted credits
  | 'PHASE_ORDERING'       // phase ordering rule failed (e.g., FINAL before PRELIM returned)
  | 'REVIEW_IN_PROGRESS';  // an open review for this phase already exists

interface BatchSubmitResult {
  anchor:
    | { projectId: string; displayProjectId: string | null; status: 'SUBMITTED'; reviewId: string; reviewDisplayId: string }
    | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_INELIGIBLE'; reason: SkipReason }
    | { projectId: string; displayProjectId: string | null; status: 'ANCHOR_FAILED'; error: { code: string; message: string } };
  children: ChildSubmitOutcome[];
  summary: {
    submittedCount: number;
    skippedCount: number;
    failedCount: number;
  };
  /**
   * When `anchor.status` is ANCHOR_INELIGIBLE or ANCHOR_FAILED, every entry in `children` is
   * SKIPPED_INELIGIBLE with `reason: 'ANCHOR_FAILED'`. This is the FL-13 cascade in action.
   */
}
```

Notes:
- `displayProjectId` is the U3 `gbciDisplayId` (e.g., `RES-100007`) when present.
- `reviewDisplayId` is the U5 `Review.displayId` (e.g., `REV-100012`) when present.
- The orchestrator never throws for child-level failures; it captures them in this structure.
  It DOES throw `409 ANCHOR_INELIGIBLE` or `500 ANCHOR_FAILED` when the anchor itself fails —
  but those errors carry a fully populated `BatchSubmitResult` payload via the standard
  exception body, so the caller can render the per-child cascade.

---

## PortfolioDashboard (DTO)

The shape returned by `GET /projects/:anchorId/portfolio`.

```ts
interface ProjectSummaryDto {
  // From the existing ProjectDto (U3) — all fields included; key ones called out:
  id: string;
  gbciDisplayId: string | null;
  name: string;
  status: ProjectStatus;
  achievedCertificationLevel: string | null;
  targetCertificationLevel: string | null;
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;

  // Joined / aggregated for the dashboard view:
  attemptedTotal: number;        // Σ awarded credit point values where attempted=true
  awardedTotal: number;          // Σ awardedPoints over the project's scorecard entries
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

interface PortfolioDashboard {
  anchor: ProjectSummaryDto;
  children: ProjectSummaryDto[];   // sorted by gbciDisplayId asc, NULLs last
  rollup: {
    totalChildren: number;
    byStatus: Record<ProjectStatus, number>;
    byCertificationLevel: Record<string, number>; // key = level name or 'NONE'
    attemptedTotal: number;
    awardedTotal: number;
  };
}
```

Notes:
- Pagination not supported (typical portfolio sizes <50). Documented as a forward-compat note;
  add `cursor`/`limit` later when needed.
- `latestReview` is a left-join over the U5 `review` table — pure read; no orchestrator cycle.
  The query selects the row with the largest `submittedAt` per `(projectId, phase)` collapsing
  to the row with the largest `phase` ordering when multiple phases exist (PRELIMINARY < FINAL
  < SUPPLEMENTAL).
- Read RBAC: any project member on the anchor (any of `OWNER | PROJECT_TEAM | GREEN_RATER |
  REVIEWER`) or global Admin.

---

## PortfolioFeeQuote (DTO)

The shape returned by `GET /projects/:anchorId/portfolio/fee-quote?phase=...`.

```ts
interface PortfolioFeeQuoteLineItem {
  projectId: string;
  displayProjectId: string | null;
  registrationFeeCents: number;   // 0 when project already has a paid registration invoice
  reviewFeeCents: number;         // 0 in this build (review fees deferred per FR-3.6)
  totalCents: number;             // sum of the two above
  warnings: { reason: string }[]; // pulled forward from FeeCalculator (e.g., 'no_fee_schedule_match')
}

interface PortfolioFeeQuote {
  anchorProjectId: string;
  phase: ReviewPhase;
  lineItems: PortfolioFeeQuoteLineItem[];   // anchor first, then children in dashboard order
  totals: {
    registrationFeeCents: number;
    reviewFeeCents: number;
    subtotalCents: number;
    taxCents: number;          // 0 in this build
    totalCents: number;
  };
  warnings: { reason: string }[]; // aggregated; deduped
}
```

Pure-aggregation rules (all in `PortfolioFeeService.quote(...)`):
1. For each project (anchor + children), call the U3 `FeeCalculator.compute(...)` with the
   project's `ratingSystemSlug` + `membershipLevel`.
2. If the project already has a `paid` Invoice in the `invoice` table, set
   `registrationFeeCents = 0` and skip the calculator entirely for that project.
3. `reviewFeeCents = 0` for all line items in this build (review fees deferred).
4. Totals are simple sums; tax is `0`.
5. Warnings dedupe by `reason`.

---

## Forward-compat (NOT implemented this build)

- **Credit-level inheritance**: the `parent_anchor_id` column is the schema seam. UI/logic for
  copying anchor credit elections to children is out per FR-5 Out-of-scope.
- **Real combined invoice** (single `Invoice` row spanning multiple projects): the U3 `invoice`
  table has a UNIQUE index on `project_id`, intentionally one-invoice-per-project for now.
  When combined billing lands (real Stripe), introduce a new `portfolio_invoice` aggregate
  pointing to per-project invoices via a join table; the `PortfolioSubmissionOrchestrator`
  contract doesn't change. This build skips invoice creation when `totalCents === 0` (the
  realistic case — registration already paid, review fees deferred).
- **Pagination on the dashboard**: deferred; documented above.

---

## Sequences / DDL

No new sequences. The U3 `RegistrationDdlBootstrapper` is extended with **column-add** and
**constraint-add** statements (idempotent via `IF NOT EXISTS` / `DO $$ BEGIN ... EXCEPTION
WHEN duplicate_object THEN NULL; END $$;` patterns). TypeORM `synchronize: true` handles the
column add, but DDL bootstrapper owns the FK + CHECK + INDEX so we don't depend on synchronize
for cross-row constraints.
