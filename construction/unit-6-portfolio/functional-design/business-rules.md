# Unit 6 — Business Rules

Authoritative business rules for the Portfolio unit. Each rule cites the originating story and
maps to its enforcement point. Decisions reflect the all-A approval of the U6 batched plan.

Rule prefixes:
- **BR-PA** Portfolio Anchor (designation + hierarchy invariant)
- **BR-BS** Batch Submit (cascade + independence)
- **BR-PF** Portfolio Fees (combined-fee aggregation)
- **BR-PM** Portfolio Membership (RBAC scoping across the portfolio)

---

## BR-PA — Portfolio Anchor & Hierarchy

### BR-PA1 — Any registered project may be designated an anchor (US-5.1)
- A project's `is_portfolio_anchor` may be toggled to `true` by Project Team / Green Rater
  members of that project, or by global Admin.
- A project does NOT need to be in `REGISTERED` status to be designated; designation is purely
  organizational metadata. (`DRAFT` projects can also be anchors — useful when the team is
  scaffolding the portfolio before paying.)
- Audit-tracked: one `audit_log` row per toggle, capturing `before`/`after`.

### BR-PA2 — Anchor depth is exactly 1 (FL-12 hierarchy invariant)
- A project may NOT be both anchor AND child. Equivalently: when
  `is_portfolio_anchor = true`, `parent_anchor_id` must be NULL.
- A child's `parent_anchor_id` must point to a project with `is_portfolio_anchor = true` AND
  `parent_anchor_id IS NULL`.
- Self-parenting is prohibited: `parent_anchor_id != id`.
- Enforced both at the application layer (pure `assertHierarchy(...)` in
  `src/portfolio/state-machine/hierarchy.invariant.ts`) AND at the database layer via the FK +
  CHECK constraints listed in `domain-entities.md`. PBT-01 target **FL-12**.

### BR-PA3 — Un-anchoring requires no remaining children (Q8)
- Toggling `is_portfolio_anchor` from `true → false` is rejected with `409 ANCHOR_HAS_CHILDREN`
  when any project still references it via `parent_anchor_id`.
- The caller must detach all children first (BR-PA5) before un-anchoring.

### BR-PA4 — Un-anchoring rejected during active batch (Q8)
- Best-effort guard: if any child has `Project.status = UNDER_REVIEW` from a portfolio batch
  submitted in the last hour, un-anchoring is rejected with `409 PORTFOLIO_BUSY`.
- Implementation: `PortfolioService.assertCanUnanchor(anchorId)` queries the children, joins
  the latest `Review` per child, and rejects when any review's `submittedAt > now - 1h` AND
  the review's project status is `UNDER_REVIEW`.
- Detach + un-anchor remain unblocked outside that window (the U5 state-lock already prevents
  PT/GR writes during UNDER_REVIEW; this rule is a defense-in-depth UX guard).

### BR-PA5 — Detach lifecycle (US-5.1, Q8)
- `PATCH /projects/:childId/parent-anchor` with body `{ parentAnchorId: null }` is allowed
  any time by PT/GR membership on the child or Admin.
- Detachment removes the row from the anchor's portfolio dashboard immediately on the next
  GET. Audit-tracked.

### BR-PA6 — Attach validation (US-5.1)
- `PATCH /projects/:childId/parent-anchor` with body `{ parentAnchorId: '<anchorId>' }`:
  1. Caller must be PT/GR on the child or Admin.
  2. Target anchor must exist; pure `assertHierarchy(child, target)` must succeed (FL-12).
  3. Target's `is_portfolio_anchor` must be `true`.
  4. Target's `parent_anchor_id` must be NULL (no chains).
  5. `target.id != child.id` (no self-parenting).
- On success: row's `parent_anchor_id` updated; `version += 1`; audit-tracked.

---

## BR-BS — Batch Submit

### BR-BS1 — Anchor-first ordering (US-7.2, FR-7.3)
- The portfolio batch-submit orchestrator submits the **anchor first**, in its own
  transaction. The children's submits do NOT begin until the anchor's transaction has
  committed successfully (BR-BS2).

### BR-BS2 — Anchor-failure cascade (FR-7.3, US-7.2, FL-13)
- When the anchor's pre-flight `assertSubmittable` fails OR the anchor's `submit` throws:
  - The orchestrator returns immediately with `anchor.status ∈ { ANCHOR_INELIGIBLE,
    ANCHOR_FAILED }`.
  - **No child mutates.** Every entry in `BatchSubmitResult.children` is
    `{ status: 'SKIPPED_INELIGIBLE', reason: 'ANCHOR_FAILED' }`.
- PBT-01 target **FL-13**: in any input where the anchor is ineligible or `submit` throws,
  `result.children.every(c => c.status !== 'SUBMITTED')` MUST hold.

### BR-BS3 — Independent children (US-7.2, FR-7.3, FL-14)
- After the anchor succeeds, each child's submit runs in its **own** transaction (sequential
  in this build for log determinism; ordering is by `gbciDisplayId` asc, NULLs last). A child's
  outcome (SUBMITTED / SKIPPED_INELIGIBLE / FAILED) does NOT affect any sibling.
- PBT-01 target **FL-14**: each child's outcome is a function of `(child state, actor, phase)`
  alone — never of any sibling's state or outcome.

### BR-BS4 — Per-child eligibility re-uses U5 SubmissionOrchestrator (BR-RW2..BR-RW8)
- The orchestrator does NOT duplicate eligibility logic. It calls
  `SubmissionOrchestrator.assertSubmittable(projectId, actor, phase)` per child (added to U5's
  service in this unit — see BR-BS6). When it throws, the child is mapped to a `SkipReason`
  per the `BatchSubmitResult` table.
- Eligibility errors that are NOT recognized fall through to `status: 'FAILED'` with the raw
  error message.

### BR-BS5 — Single phase per batch (Q5)
- The `phase` parameter on `POST /projects/:anchorId/portfolio/submit` applies to every project
  in the batch (anchor + children). Mixed phases per child are out of scope (would require a
  body of `{ projectId, phase }[]` — deferred).

### BR-BS6 — Eligibility-only assertion (extracted from U5)
- This unit extends `SubmissionOrchestrator` with a public `assertSubmittable(projectId,
  actor, phase): Promise<void>` method. Implementation-wise, it's the same checks that already
  run inside `submit(...)`, lifted into a private `validateSubmittable` and exposed via the
  public method. The `submit(...)` body calls the extracted method first to preserve identical
  semantics. **Refactor only — no behavior change for U5 callers.**

### BR-BS7 — RBAC: anchor membership required to invoke (Q6, NFR-5.1)
- `POST /projects/:anchorId/portfolio/submit` requires PT/GR membership on the **anchor** (or
  Admin). Without it: `403 FORBIDDEN`.
- For each child: caller's PT/GR membership on the child is re-checked at submit time. Missing
  membership ⇒ child mapped to `{ status: 'SKIPPED_INELIGIBLE', reason: 'NO_MEMBERSHIP' }`. The
  batch is NOT aborted.

### BR-BS8 — Audit at orchestrator boundary
- The orchestrator records two kinds of audit entries:
  - One `audit_log` row per batch invocation, `entityType = 'PortfolioBatch.submit'`,
    `entityId = anchorId`, with the `phase` and `summary` in `after`.
  - One per-child outcome row, `entityType = 'PortfolioBatch.child'`, `entityId = childId`,
    `before = null`, `after = { status, reason?, error?, reviewId? }`.
- Per-project Review row creation is already audited by the U5 `SubmissionOrchestrator`;
  these batch-level entries are additive, not duplicative.

---

## BR-PF — Portfolio Fees (combined billing)

### BR-PF1 — Aggregate quote is pure (Q5)
- `GET /projects/:anchorId/portfolio/fee-quote?phase=...` is a pure read: no DB writes, no
  side effects. Idempotent.
- Aggregation rules per `domain-entities.md` § PortfolioFeeQuote.

### BR-PF2 — `pay-and-submit` skips invoice when total is zero
- `POST /projects/:anchorId/portfolio/pay-and-submit` first calls `PortfolioFeeService.quote
  (...)`. When `totalCents === 0` (the realistic case in this build — registration paid,
  review fees deferred), it skips invoice creation entirely and proceeds directly to the
  batch submit orchestrator.
- When `totalCents > 0`: forward-compat path. The current build does NOT create combined
  invoices (the U3 `invoice` table has a per-project UNIQUE index, intentionally one-invoice-
  per-project). Instead, the endpoint returns `501 NOT_IMPLEMENTED` with a message pointing to
  the deferred work. This is the only payment-path NOT exercised in this build; documented and
  surfaced clearly.

### BR-PF3 — Pay before submit (US-5.3)
- The orchestrator never starts the batch submit until the payment step (currently a no-op when
  total is $0; future Stripe call when not) returns success. On payment failure: the batch
  does NOT mutate any project; an error is returned with full per-project state.

### BR-PF4 — RBAC: anchor PT/GR or Admin (NFR-5.1)
- `pay-and-submit` requires the same RBAC as `submit` (BR-BS7). The fee-quote GET is readable
  by any project member on the anchor (broader read-only access).

---

## BR-PM — Portfolio Membership

### BR-PM1 — Per-project membership remains source of truth (NFR-5.1, Q6)
- The portfolio adds NO new RBAC concept. There is no "portfolio member" role. Each project's
  membership table row continues to be the only authority for who can read / write that
  project.
- Implication: a user can be PT on the anchor but lack any membership on a child. That user
  CAN trigger a portfolio batch submit (anchor membership suffices); the children where they
  lack membership are returned as `SKIPPED_INELIGIBLE { reason: 'NO_MEMBERSHIP' }` per BR-BS7.

### BR-PM2 — Anchor read access ⊇ children read access (Q3)
- The dashboard endpoint requires only **any** project membership on the anchor. The dashboard
  intentionally exposes child summary data even when the caller lacks membership on those
  children — this is by design: the dashboard is the anchor's view of "what's in my portfolio,"
  not a data-export route. Sensitive per-child data (notes, submittals, scorecard details)
  remain protected by their own per-project guards.
- Admin always passes everywhere.

---

## BR-Z — State-lock interplay (no change)

- U5 `StateLockService` real implementation already blocks PT/GR writes when
  `Project.status = UNDER_REVIEW`. After a portfolio batch submit, every successfully-submitted
  project is in `UNDER_REVIEW` and its writes are blocked by U5's logic. U6 makes no changes
  to the state lock.
- The portfolio dashboard read is NOT blocked by the state-lock (reads are always allowed; the
  state-lock applies to writers).
- Detach (BR-PA5) and un-anchor (BR-PA3) **are** writes on the project row, so they go through
  `assertWritable`. During UNDER_REVIEW, PT/GR cannot detach a child or un-anchor — Admin can.
  This is intentional (U5 state-lock semantics carry forward unchanged).

---

## Story → Rule traceability

| Story | Rules |
|---|---|
| US-5.1 Designate anchor / attach child | BR-PA1, BR-PA2, BR-PA3, BR-PA4, BR-PA5, BR-PA6 |
| US-5.2 Portfolio dashboard | BR-PM2 + the `domain-entities.md` § PortfolioDashboard contract |
| US-5.3 Pay & submit portfolio together | BR-PF1, BR-PF2, BR-PF3, BR-PF4, BR-BS1..BR-BS8 |
| US-7.2 Batch submit (anchor cascade + independence) | BR-BS1..BR-BS8 (especially BR-BS2 / BR-BS3) |
| Cross-cutting: RBAC | BR-BS7, BR-PM1, BR-PM2, BR-PF4 |
| Cross-cutting: state-lock | BR-Z (carry-forward, no change) |
| Cross-cutting: audit | BR-PA1, BR-PA5, BR-PA6, BR-BS8, BR-PF (writes only) |

---

## PBT-01 properties summary (full subjects in `business-logic-model.md`)

- **FL-12** Hierarchy invariant (BR-PA2). Pure subject:
  `assertHierarchy(child, candidateAnchor): void`.
- **FL-13** Anchor-failure cascade (BR-BS2). Subject:
  `PortfolioSubmissionOrchestrator.submit(...)` return-value invariant.
- **FL-14** Independent children (BR-BS3). Same subject; per-child outcome depends only on
  that child's state, never on siblings.
