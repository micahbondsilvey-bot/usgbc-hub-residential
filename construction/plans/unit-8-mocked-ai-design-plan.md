# Unit 8 — Mocked AI — Batched Design Plan (FD only)

**Cadence**: NFR Requirements + NFR Design SKIPPED for U8 (carried forward from
U3..U7). All cross-cutting NFRs from prior units inherit unchanged. Tests skipped per the
documented PBT deviation (PBT-01 properties FL-18/FL-19 identified; PBT-02..08, PBT-10
deferred).

**Scope**: US-6.1 (Run completeness & consistency check — mocked) and US-8.1 (Reviewer
pre-review analysis — mocked). The `AiInsightProvider` seam exists once with a single mock
implementation that serves both surfaces; the run is async in-process with status polling;
findings are advisory and never auto-approve.

**Out of scope (deferred to a future build / future units)**:
- Real LLM integration (the seam exists; the impl is mocked).
- Asynchronous workers / queues / WebSocket push (in-process `setImmediate` is sufficient
  for the mock).
- Per-finding comment threads — only ack / ignore for this build.

**Architectural decisions inherited from prior units** (all defaults are taken):

| From | Decision | U8 reuse |
|---|---|---|
| U1 | `AuthGuard` + `ProjectRolesGuard` + `@CurrentUser()` + `AuditService` + `Logger` | Same |
| U1 | `RequestContext` ↔ audit | All AI service calls audit the actor |
| U1 | Global `JwtAuthGuard` via `APP_GUARD` | Do NOT add local `@UseGuards(JwtAuthGuard)` on new controllers (lesson from U7) |
| U2 | `ScorecardEntry`, attempted/verified/awarded | Snapshot source for findings |
| U2 | `LastWriterWins` + `version` | Same on `ai_insight_finding` |
| U4 | `WorkbookFieldEntry`, `Submittal`, `VerificationNote` | Snapshot source for findings |
| U5 | `Review` + `ReviewPhase` + `ReviewStatus` | "Pre-review" surface; not the same as a real review |
| U7 | `NotificationKind.AI_RUN_COMPLETED`? | **No** — runs are foreground-polled; no notification fired. |

---

## Stories in scope

| Story | Title | Personas | Acceptance summary |
|---|---|---|---|
| US-6.1 | Run completeness & consistency check (mocked) | P2 (Green Rater) | Async "Analyzing…" state, mock provider returns missing/insufficient evidence + cross-credit contradictions, each finding has a suggested action, results stored, never auto-approves, human acks/ignores. |
| US-8.1 | Reviewer pre-review analysis (mocked) | P3 (Reviewer), P2 (Green Rater for pre-submission) | Same `AiInsightProvider`, attention flags surfaced per-credit, advisory, human ack/ignore. |

---

## Q1–Q10 design questions (recommended "A" answers indicated)

> Per the established cadence: defaults are taken and execution proceeds in the same wave.

### Q1 — Mock AI seam shape
- **A (recommended)**: One `AiInsightProvider` interface + one `MockAiInsightProvider`
  implementation injected via the `AI_INSIGHT_PROVIDER` token. The provider is **pure**:
  it takes a `ProjectSnapshot` value and returns `ProvisionalFinding[]`. No I/O, no DB
  access; the `AiInsightsService` orchestrator does the DB work.
- B: Separate "completeness" and "consistency" providers.
- C: Stub directly in the service (no seam).

### Q2 — Run lifecycle
- **A (recommended)**: Persist an `AiInsightRun` row up-front with status `QUEUED`,
  fire-and-forget `setImmediate(() => execute())`, status transitions
  `QUEUED → RUNNING → COMPLETED|FAILED`. Frontend polls `GET /ai-runs/:id` every 2s
  until `status ∈ {COMPLETED, FAILED}`.
- B: Synchronous run (return findings in the same response).
- C: BullMQ / Redis queue.

### Q3 — Run types + trigger surfaces
- **A (recommended)**: One endpoint with a `type` query: `POST
  /api/v1/projects/:projectId/ai-runs?type=PRE_SUBMISSION|PRE_REVIEW`.
  - `PRE_SUBMISSION`: Green Rater or Admin role required; usable any time the project is
    open (state-lock does NOT block since the run is read-only).
  - `PRE_REVIEW`: Reviewer or Admin role required; ideally runs while a Review exists
    in `SUBMITTED` or `OPEN` state, but no hard precondition (advisory).
  - `GET /api/v1/projects/:projectId/ai-runs` — list latest runs (basic pagination).
  - `GET /api/v1/projects/:projectId/ai-runs/:runId` — single run + findings.
  - `POST /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/acknowledge`
  - `POST /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/ignore`
- B: Two separate top-level endpoints (`/ai/pre-submission`, `/ai/pre-review`).
- C: Embed under `/workbook` and `/review` paths.

### Q4 — Finding shape + kinds
- **A (recommended)**:
  - `kind: MISSING_EVIDENCE | INSUFFICIENT_EVIDENCE | CROSS_CREDIT_CONTRADICTION | ATTENTION_FLAG`
  - `severity: HIGH | MEDIUM | LOW`
  - `creditId: UUID | null` (null for portfolio-level / cross-cutting)
  - `title: text`, `description: text`, `suggestedAction: text` (NOT a flag — a specific
    actionable next step, e.g. "Upload a photo to slot 'pre-construction'".)
  - `status: NEW | ACKNOWLEDGED | IGNORED` + `acknowledgedAt: timestamptz | null` +
    `ignoredAt: timestamptz | null`
- B: Free-form `text` only.
- C: Skip severity.

### Q5 — Visibility / RBAC
- **A (recommended)**:
  - Project members (PT, GR, Reviewer) + Admin can READ all findings for the project.
  - `PRE_SUBMISSION` runs can be initiated by GR + Admin.
  - `PRE_REVIEW` runs can be initiated by Reviewer + Admin.
  - Ack/ignore: any project member of the runner role (i.e. `PRE_SUBMISSION` findings can
    be ack/ignored by GR/PT/Admin; `PRE_REVIEW` by Reviewer/Admin).
- B: Public to project; any member can ack.
- C: Stricter — only the original runner can ack.

### Q6 — Storage
- **A (recommended)**: Two new tables.
  - `ai_insight_run`: `id`, `projectId`, `type`, `status`, `ranByUserId`, `ranByGlobalRole`,
    `startedAt`, `completedAt | null`, `failureReason | null`, `summary jsonb` (counts by
    kind), `version` + `AuditBase`.
  - `ai_insight_finding`: `id`, `runId`, `kind`, `severity`, `creditId | null`,
    `title`, `description`, `suggestedAction`, `status`, `acknowledgedAt`, `ignoredAt`,
    `acknowledgedByUserId`, `ignoredByUserId`, `version` + `AuditBase`. FK `runId →
    ai_insight_run.id ON DELETE CASCADE`.
  - Indexes: `(projectId, startedAt DESC)`, `(runId, kind, severity DESC)`,
    `(projectId, type, completedAt DESC)`.
- B: Single denormalized table.

### Q7 — Mock provider determinism
- **A (recommended)**: The provider is a **pure function** over a `ProjectSnapshot` value
  (scorecard rows, workbook field entries, submittals, verification notes, attempts).
  Rules (FL-18 subject):
  - For each attempted credit with NO submittal at all → `MISSING_EVIDENCE` (HIGH).
  - For each attempted credit with submittals but NO Green Rater note → `INSUFFICIENT_EVIDENCE` (MEDIUM).
  - For `PRE_REVIEW` runs only: for each attempted credit with `awardedPoints < verifiedPoints`
    → `ATTENTION_FLAG` (LOW).
  - If `sum(attemptedPoints) > rating-system maximum (e.g. 110)` → one
    `CROSS_CREDIT_CONTRADICTION` (HIGH).
  - Findings are sorted by `severity DESC` then `creditCode ASC` for stable ordering.
- B: Random seed.
- C: Hard-coded canned findings.

### Q8 — Concurrency / locking
- **A (recommended)**: At most ONE in-flight run per `(projectId, type)`. New `POST` while a
  run is `RUNNING` returns `409 CONFLICT` with the existing run id. After completion the
  next `POST` creates a fresh run.
- B: Allow concurrent runs.

### Q9 — FE surfaces
- **A (recommended)**:
  - `features/ai/` folder with:
    - `ai-run-button.component` (reusable: takes `projectId` + `type`, shows "Run", then
      "Analyzing…" with spinner while polling).
    - `ai-findings-panel.component` (groups by severity, action buttons per finding).
    - `ai-runs.store` (signal-backed, manages run lifecycle + polling + finding ack/ignore).
  - Embed `ai-run-button` + `ai-findings-panel` in:
    - `WorkbookPageComponent` header (PRE_SUBMISSION).
    - `ReviewPageComponent` (PRE_REVIEW), visible to Reviewer role.
- B: Single AI page at `/projects/:id/ai`.

### Q10 — PBT subjects
- **A (recommended)**:
  - **FL-18** Finding determinism — `generateAiFindings(snapshot)` is pure; same snapshot ⇒
    same ordered finding set; no Date.now()/Math.random().
  - **FL-19** Ack/ignore idempotence — calling `ack(id)` twice keeps `status=ACKNOWLEDGED`
    and does NOT update `acknowledgedAt` on the second call; same for `ignore`.

---

## FD artifacts to generate

- [x] `aidlc-docs/construction/unit-8-mocked-ai/functional-design/domain-entities.md`
- [x] `aidlc-docs/construction/unit-8-mocked-ai/functional-design/business-rules.md`
- [x] `aidlc-docs/construction/unit-8-mocked-ai/functional-design/business-logic-model.md`
- [x] `aidlc-docs/construction/unit-8-mocked-ai/functional-design/frontend-components.md`

## Code generation plan

See `aidlc-docs/construction/plans/unit-8-mocked-ai-code-generation-plan.md`.
