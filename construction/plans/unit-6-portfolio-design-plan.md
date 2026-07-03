# Unit 6 — Portfolio — Batched Design Plan

**Cadence note (carried forward from U3/U4/U5).** Per user direction:
- **NFR Requirements stage SKIPPED for U6.** No new infra (no new provider seam this build —
  payment continues to use the U3 mocked `PaymentProvider`; notifications continue to use the
  U1 `NotificationGateway` mock; reports remain Markdown text per U5).
- **NFR Design stage SKIPPED for U6.** All cross-cutting NFR concerns (Angular 20.2 / Node
  20.19, NestJS, PostgreSQL, Redis, fast-check, ≥100 PBT runs, WCAG 2.1 AA, throttler, audit,
  RBAC, request-context, mock notifications, hooks registry from U4, state-lock from U5)
  inherit unchanged.
- **What U6 will produce:** Functional Design (4 artifacts) + Code Generation Plan in one
  approval-gated wave, then code execution. PBT-01 properties identified for the hierarchy
  invariant, the anchor-failure cascade, and the independent-children rule.

---

## Stories in scope (per `unit-of-work.md`)

| Story | Title | Notes |
|---|---|---|
| US-5.1 | Designate a portfolio anchor | Self-referencing hierarchy via nullable `parent_anchor_id` (NFR-2.2); any registered project can be an anchor. |
| US-5.2 | Portfolio dashboard | Anchor view listing all child projects with status; navigate anchor ↔ child. |
| US-5.3 | Pay & submit portfolio together | Combined fee aggregation + single-invoice line-items + batch submit. Payment processing deferred (mocked seam). |
| US-7.2 | Batch submit (anchor failure cascades to children) | Anchor must submit first; if anchor submit fails, no child submits. Independent (non-anchor) projects in a batch transition individually. |

Out-of-scope (later units / future builds):
- Credit-level inheritance / bulk inheritance toggle / AI portfolio delta review (out per FR-5
  Out-of-scope; not in this build).
- All-dashboards framework → U7 Dashboards & Notifications (U6 ships only the **portfolio**
  dashboard for the anchor view).
- Workflow notifications framework → U7 (U6 fires the existing U1 `NotificationGateway.send`
  for the immediate batch-submit events).
- Real payment processing → out of scope this build (FR-3.6); mocked `PaymentProvider`.
- Mobile/PWA polish → U9.

---

## Architectural decisions inherited (NOT re-asked)

| From | Decision |
|---|---|
| U1-Q1 | Hybrid RBAC: global Admin + per-project roles. `ProjectRolesGuard` protects all `/projects/:id/portfolio/*` routes. |
| U1-Q2 | `AuditStampInterceptor` for HTTP writes; explicit `AuditService.record` on anchor designation, child attach/detach, batch submit kickoff/result. |
| U1 | `RequestContext` carries `actorUserId` for membership checks across the orchestrator. |
| U2-Q4 | Last-write-wins; `version: integer` on every persisted row. New `parent_anchor_id` and `is_portfolio_anchor` columns added directly to the existing `projects` table — same versioning contract. |
| U3 | `Project` entity owns the hierarchy columns. `Invoice` + `PaymentProvider` mock reused for combined-fee path. `RES-100001+` display-id sequence unchanged. |
| U4 | `WorkbookAttemptHookRegistry` proves the cross-module hook pattern; not needed for U6 (portfolio is at the project-aggregate grain, not the credit grain). |
| U5 | `SubmissionOrchestrator` is the single submit entry-point; `PortfolioSubmissionOrchestrator` composes it per-project under the cascade rule. `StateLockService` real impl already enforces `UNDER_REVIEW` across U2/U4 writers — no change needed. `Review` rows are always per-project (one Review per `(project, phase)`); a portfolio batch yields N Review rows, not one. |

---

## Design questions (10)

> All FD-level. Recommended option in **bold**. An "all-A" reply produces a coherent design.

### Q1 — Hierarchy persistence shape (US-5.1, FR-5.4 / NFR-2.2)
- A. **Extend the existing `projects` table with two columns: `is_portfolio_anchor BOOLEAN
  NOT NULL DEFAULT false` and `parent_anchor_id UUID NULL` (self-referential FK to
  `projects.id`, `ON DELETE RESTRICT`). DB constraints (enforced via DDL bootstrapper, mirroring
  U3's pattern):
  - `parent_anchor_id != id` (no self-parenting).
  - `parent_anchor_id IS NOT NULL` ⇒ the target row must have `is_portfolio_anchor = true`
    AND `parent_anchor_id IS NULL` (depth = 1; anchors are roots, children attach to anchors;
    no chain of anchors).
  Index on `(parent_anchor_id)` for the dashboard list query. PBT-01 target **FL-12**
  hierarchy invariant.**
- B. New `PortfolioMembership` join table (anchorId, childId, position).

### Q2 — Anchor-designation API (US-5.1)
- A. **Two narrow PATCH endpoints on the existing project resource (RBAC: Project Team / Green
  Rater on the project, or Admin):
  - `PATCH /projects/:projectId/anchor` body `{ isPortfolioAnchor: boolean }` — toggles the
    flag. Un-anchoring is rejected with `409` when any project still references it via
    `parent_anchor_id` (BR-PA3).
  - `PATCH /projects/:projectId/parent-anchor` body `{ parentAnchorId: string | null }` —
    attaches/detaches the project to/from an anchor. Validates the target is an anchor with
    `parent_anchor_id IS NULL` (FL-12). Self-reference blocked. A project that is itself an
    anchor cannot be attached to another anchor (no chains).
  Both routes audit-tracked via `AuditService.record`.**
- B. Single mutation endpoint that takes both fields together.

### Q3 — Portfolio dashboard read model (US-5.2)
- A. **New read-only endpoint `GET /projects/:anchorId/portfolio` (RBAC: any project member on
  the anchor, or Admin). Returns:
  ```
  {
    anchor: ProjectSummaryDto,
    children: ProjectSummaryDto[],   // sorted by displayProjectId
    rollup: {
      totalChildren: number,
      byStatus: Record<ProjectStatus, number>,
      byCertificationLevel: Record<CertificationLevel | 'NONE', number>,
      attemptedTotal: number,        // Σ children.attemptedTotal
      awardedTotal:   number         // Σ children.awardedTotal (or 0 where missing)
    }
  }
  ```
  `ProjectSummaryDto` reuses the existing `ProjectDto` plus `latestReviewStatus`,
  `latestReviewPhase`, `latestReviewOutcome` (joined from U5 `Review` table — pure read, no
  cycle). Pure aggregation service in `PortfolioService.buildDashboard(anchorId)`. Pagination
  deferred (typical portfolio size <50; documented).**
- B. Reuse `GET /projects?parentAnchorId=...` filter only.

### Q4 — Batch submit orchestrator (US-5.3, US-7.2, FR-7.3)
- A. **New `PortfolioSubmissionOrchestrator` (own service). Endpoint
  `POST /projects/:anchorId/portfolio/submit` body `{ phase: ReviewPhase }` (RBAC: Project Team
  or Green Rater on the anchor; per-child membership re-checked in step 2). Algorithm:
  1. **Pre-flight (no DB writes):** assert anchor exists with `is_portfolio_anchor = true`;
     gather children via `parent_anchor_id`; for each (anchor + children), run U5
     `SubmissionOrchestrator.assertSubmittable(projectId, actor, phase)`. Build a per-project
     eligibility map. If the **anchor** is ineligible, abort with `409 ANCHOR_INELIGIBLE` and
     return the eligibility map; **no children submit** (FL-13 anchor-failure cascade).
  2. **Anchor submit:** call `SubmissionOrchestrator.submit(anchorId, actor, phase)` inside a
     transaction. If it throws, abort the batch with the failure attached; **no children
     submit** (FL-13). Otherwise capture the anchor's `reviewId`.
  3. **Children submit (independent):** iterate eligible children. For each child, call
     `SubmissionOrchestrator.submit(childId, actor, phase)` inside its **own** transaction.
     Capture per-child success/failure. A child's failure does NOT abort the rest of the batch
     (FL-14 independent-children invariant).
  4. **Result:** return `BatchSubmitResult`:
     ```
     {
       anchor: { projectId, reviewId, status: 'SUBMITTED' },
       children: [
         { projectId, status: 'SUBMITTED', reviewId } |
         { projectId, status: 'SKIPPED_INELIGIBLE', reason } |
         { projectId, status: 'FAILED', error }
       ],
       summary: { submittedCount, skippedCount, failedCount }
     }
     ```
  Audit-tracked at the orchestrator boundary (one `audit_log` row for the batch + one per
  child outcome).**
- B. Single transaction wrapping the entire batch (anchor + all children) — all-or-nothing.

### Q5 — Combined fee logic (US-5.3)
- A. **Reuse the U3 `FeeCalculator` per project, then aggregate at the orchestrator:
  - `GET /projects/:anchorId/portfolio/fee-quote?phase=...` — pure aggregation. Returns
    `{ lineItems: [{ projectId, displayProjectId, registrationFee, reviewFee }], totals }`.
    Idempotent; no DB writes.
  - `POST /projects/:anchorId/portfolio/pay-and-submit` body `{ phase, paymentMethod }` — runs
    the quote, creates ONE `Invoice` row with line-items spanning all projects in the
    portfolio, calls the mocked `PaymentProvider.charge(invoice)` (always succeeds in this
    build), then invokes the batch orchestrator from Q4.
  Forward-compat: real Stripe integration replaces the mock provider; the orchestrator contract
  doesn't change. Note: the **registration** fee is only charged for projects that haven't yet
  paid their registration fee; already-registered children only pay the **review** fee. The
  invoice line-items make this explicit.**
- B. Separate invoice per project, then a batch payment intent.

### Q6 — RBAC scope across the portfolio (US-7.2 / NFR-5.1)
- A. **Per-project membership is the source of truth. The caller must hold Project Team or
  Green Rater membership on the **anchor** to invoke the batch endpoint. For each child,
  membership is re-checked at submit time inside `SubmissionOrchestrator` (existing U5
  guard). Children where the caller lacks membership are returned as
  `SKIPPED_INELIGIBLE { reason: 'NO_MEMBERSHIP' }` — they don't fail the batch. Admin always
  passes everywhere.**
- B. Anchor membership implicitly grants child access.

### Q7 — Anchor-outcome cascade scope (FR-5.3, US-5.3)
- A. **Cascade is **at submission only**, never at certification. Each project (anchor +
  children) gets its own U5 `Review` row, its own per-credit decisions, and its own outcome.
  An anchor that fails review does **not** auto-fail children's certification — children retain
  independent reviewer decisions. The schema accommodates future credit-level inheritance via
  the existing `parent_anchor_id` column (NFR-2.2) but no UI/logic this build. Documented as
  a forward-compat note in `business-rules.md`.**
- B. Auto-cascade anchor's review outcome to all children's certification.

### Q8 — Detach / un-anchor lifecycle (US-5.1)
- A. **Hard rules:
  - **Detach a child** (`PATCH /projects/:childId/parent-anchor` with `null`): allowed any time
    by Project Team / Green Rater on the child or Admin. Audit-tracked. Removes the row from
    the anchor's portfolio dashboard immediately.
  - **Un-anchor a project** (toggle `isPortfolioAnchor = false`): rejected with `409
    ANCHOR_HAS_CHILDREN` when any project still references it. Caller must detach all children
    first.
  - **Un-anchor with active batch in flight:** rejected with `409 PORTFOLIO_BUSY` when any
    child has `Project.status = UNDER_REVIEW` from a batch submitted in the last hour
    (best-effort guard; real lock not needed because `assertWritable` already blocks
    UNDER_REVIEW).**
- B. Allow un-anchoring with auto-detach side effects.

### Q9 — Frontend surface (US-5.1, US-5.2, US-5.3, US-7.2)
- A. **New `features/portfolio/` lazy feature:
  - `portfolio-page.component` — anchor view at `/projects/:anchorId/portfolio`. Material card
    with anchor summary; Material table of children (displayId, name, status chip,
    certificationLevel, attempted/awarded). Action buttons: **"Pay & submit portfolio"**
    (US-5.3 + US-7.2 single click; phase selector dialog, fee-quote preview, confirm), **"Add
    child to portfolio"** (designate-anchor.dialog opens project picker), **"Open child"**
    (router-link to child detail).
  - `designate-anchor.dialog.component` — per-project dialog (opened from existing project
    detail page) with toggle "Make this project a portfolio anchor" + "Attach to anchor"
    project picker. Disables un-anchor when children remain.
  - `batch-submit.dialog.component` — phase selector, eligibility preview pulled from a new
    pre-flight endpoint, fee-quote totals, "Pay & submit" CTA. After submit: shows
    BatchSubmitResult (per-project status with anchor result first).
  - Project detail page gains a "Portfolio" tab/section: if project is an anchor → button
    "Open portfolio dashboard"; if attached → label "Member of portfolio: <anchor displayId>"
    with link.
  - DTOs: extend `dto.ts`. ApiClient: extend with portfolio methods.
  - Routes: `/projects/:anchorId/portfolio` (lazy).**
- B. Inline within existing project detail page only (no separate route).

### Q10 — PBT-01 invariants (state-machine + invariant style)
- A. **Three properties identified, each implemented as a pure / test-friendly subject:
  - **FL-12 Hierarchy invariant** (`assertHierarchy(project, candidateParentAnchor)` pure
    function in `src/portfolio/state-machine/hierarchy.invariant.ts`). For all `(p, a)`:
    `a == null` OR `(a.id != p.id AND a.isPortfolioAnchor == true AND a.parentAnchorId ==
    null)`. Used by both PATCH endpoints in Q2.
  - **FL-13 Anchor-failure-cascade invariant** (subject: `PortfolioSubmissionOrchestrator.submit`
    return value). Property: for any input where the anchor is ineligible OR the anchor's
    `submit` throws, the result must satisfy
    `result.children.every(c => c.status != 'SUBMITTED')`. (Children never submit when anchor
    fails.)
  - **FL-14 Independent-children invariant** (subject same). Property: in any successful-anchor
    batch, the success/failure of each child depends ONLY on that child's pre-flight state +
    its own `SubmissionOrchestrator.submit` outcome — siblings never affect each other.
    Encoded by passing a deterministic per-child fixture and asserting per-child outcome
    matches the fixture.**
- B. Skip PBT for U6 entirely.

---

## Approval gate

After your answers, I will (one wave):
1. Generate `aidlc-docs/construction/unit-6-portfolio/functional-design/{domain-entities,
   business-rules, business-logic-model, frontend-components}.md`.
2. Generate `aidlc-docs/construction/plans/unit-6-portfolio-code-generation-plan.md`.
3. Mark this batched plan checklist complete and update `aidlc-state.md`.

> Tests remain skipped per the U1 PBT deviation. PBT-01 properties for U6:
> - **FL-12** Hierarchy invariant (pure).
> - **FL-13** Anchor-failure-cascade invariant (orchestrator-level).
> - **FL-14** Independent-children invariant (orchestrator-level).

---

## Part 2 generation checklist

- [x] FD: `domain-entities.md` — `Project` extension columns (`is_portfolio_anchor`,
      `parent_anchor_id` + FK + check constraints), `BatchSubmitResult` DTO, `PortfolioDashboard`
      DTO, `PortfolioFeeQuote` DTO. No new table.
- [x] FD: `business-rules.md` — BR-PA (portfolio anchor designation + hierarchy invariant), BR-BS
      (batch submit cascade + independence), BR-PF (portfolio fee aggregation + single-invoice),
      BR-PM (membership scoping across portfolio).
- [x] FD: `business-logic-model.md` — designate/attach/detach orchestration, dashboard
      aggregation, batch-submit orchestrator with anchor-first cascade and independent children,
      pay-and-submit composition, FL-12..FL-14 properties.
- [x] FD: `frontend-components.md` — portfolio-page, designate-anchor.dialog, batch-submit.dialog,
      project-detail "Portfolio" section, dto.ts/api-client.ts extensions, lazy route.
- [x] Plan: `unit-6-portfolio-code-generation-plan.md` — numbered backend steps (DDL bootstrapper
      extension, Project entity columns, hierarchy invariant module, PortfolioService, orchestrator,
      controller, fee-quote service) + frontend (portfolio feature + dialogs + dto/api-client +
      project-detail edit) + docs + validation; story coverage table (US-5.1, US-5.2, US-5.3, US-7.2).
- [x] State: mark U6 FD ✅ in `aidlc-state.md`; NFRR/NFRD rows show `— (skipped per user)`.
- [x] Audit: log this batched plan + the user's answers.
