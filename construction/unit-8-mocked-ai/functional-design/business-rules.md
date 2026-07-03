# Unit 8 — Business Rules

Rule IDs use the `BR-AI*` prefix. Cross-cutting rules from U1 (audit, RBAC),
U2 (LWW + version), U4 (workbook/submittals), and U5 (review phases) are
inherited unchanged.

---

## BR-AI1 — AI is advisory, never auto-approves
- The `AiInsightProvider` never writes to the scorecard, workbook, or review.
- No finding can change a credit's `attempted`, `verifiedPoints`, or `awardedPoints`.
- The only state mutated by AI machinery is the `ai_insight_run` and
  `ai_insight_finding` tables.
- Direct quote from US-6.1: "AI never auto-approves; I explicitly acknowledge or
  ignore each."

## BR-AI2 — Run lifecycle states (state machine)
States: `QUEUED → RUNNING → COMPLETED | FAILED`.
- Inserted as `QUEUED` so the FE has an id to poll immediately.
- The orchestrator schedules `setImmediate(() => execute())` after the insert
  commits.
- `execute()` flips the row to `RUNNING`, builds the snapshot, calls the provider,
  persists findings, then flips to `COMPLETED` (or `FAILED` on any thrown error,
  capturing `err.message` in `failureReason`).
- Once `COMPLETED` or `FAILED`, the row is terminal — no further transitions.

## BR-AI3 — At most one in-flight run per (projectId, type)
- Before inserting a new `QUEUED` row, the orchestrator queries:
  `SELECT id FROM ai_insight_run WHERE project_id=? AND type=? AND status IN
  ('QUEUED','RUNNING') LIMIT 1`.
- If a row is returned: respond `409 Conflict` with `{ existingRunId, status }`.
- After a row completes, a new run for the same (projectId, type) is allowed.

## BR-AI4 — Findings must carry an actionable suggestion
- `suggestedAction` is required (non-empty, ≤ 500 chars).
- The mock provider's catalogs are wordsmith-tuned to provide concrete next steps
  (e.g. "Upload a photo or PDF into the 'pre-construction documentation' slot for
  EAp1.").
- Direct quote from US-6.1: "Each finding includes a specific, actionable suggested
  action (not just a flag)."

## BR-AI5 — Acknowledge / ignore semantics
- Both operations are project-member RBAC gated (PT + GR + Reviewer + Admin can
  read; `PRE_SUBMISSION` findings may be ack'd by GR/PT/Admin; `PRE_REVIEW` by
  Reviewer/Admin).
- `ack`: if `status = NEW`, sets `status=ACKNOWLEDGED`, `acknowledgedAt=NOW()`,
  `acknowledgedByUserId=actor`. If already `ACKNOWLEDGED` or `IGNORED`, no-op
  (idempotent — FL-19 subject).
- `ignore`: symmetric with `IGNORED` status.
- Both increment `version` by 1 only on the first transition; idempotent calls do
  NOT increment.

## BR-AI6 — Finding determinism (FL-18 PBT subject)
- `generateAiFindings(snapshot)` is **pure** — no `Date.now()`, no `Math.random()`,
  no I/O.
- Same `ProjectSnapshot` ⇒ same `ProvisionalFinding[]` (deep-equal, including
  ordering).
- Ordering: `severity` (HIGH > MEDIUM > LOW) → then `creditCode ASC` (nulls last)
  → then `kind ASC` (alphabetical).
- Persisted findings preserve this order so the FE can render `findings[]` as-is.

## BR-AI7 — Provider rules (mock determinism contract)

Given a `ProjectSnapshot s`:

1. For each `credit c` where `c.attempted === true` AND `c.submittalCount === 0`:
   emit one `MISSING_EVIDENCE / HIGH` finding pointed at `c`.
   - title: `"Missing evidence for {creditCode}"`
   - suggestedAction: `"Upload at least one submittal under the credit's required
     slot(s) to support the {points} attempted point(s)."`
2. For each `credit c` where `c.attempted === true` AND `c.submittalCount > 0` AND
   `!c.hasGreenRaterNote`: emit `INSUFFICIENT_EVIDENCE / MEDIUM`.
   - title: `"Submittal lacks Green Rater note for {creditCode}"`
   - suggestedAction: `"Add a Green Rater verification note explaining how the
     uploaded evidence demonstrates compliance."`
3. If `s.type === PRE_REVIEW`: for each `credit c` where `c.attempted` AND
   `c.awardedPoints < c.verifiedPoints`: emit `ATTENTION_FLAG / LOW`.
   - title: `"Awarded points below verified for {creditCode}"`
   - suggestedAction: `"Re-confirm whether the gap between verified and awarded is
     intentional before finalizing the report."`
4. Compute `attemptedTotal = sum(c.attemptedPoints for c in s.credits where attempted)`.
   If `attemptedTotal > s.ratingSystemMaxPoints`: emit ONE
   `CROSS_CREDIT_CONTRADICTION / HIGH` with `creditId = null`.
   - title: `"Attempted total exceeds rating-system maximum"`
   - description: `"Attempted {attemptedTotal} > maximum {max}."`
   - suggestedAction: `"Reduce attempted points so the running total does not
     exceed the rating-system cap."`

The rule list is exhaustive — the mock provider returns NO other kinds.

## BR-AI8 — Audit trail (cross-cut with U1)
Every run start, every state transition, every ack/ignore writes an `AuditLog` row:
- `entity: 'ai_insight_run'` or `'ai_insight_finding'`
- `entityId: runId or findingId`
- `action: 'RUN_QUEUED' | 'RUN_STARTED' | 'RUN_COMPLETED' | 'RUN_FAILED' |
  'FINDING_ACKNOWLEDGED' | 'FINDING_IGNORED'`
- `metadata: jsonb` (projectId, type, summary counts where relevant).

## BR-AI9 — RBAC
- `POST /projects/:projectId/ai-runs?type=PRE_SUBMISSION` requires
  `ProjectRoles(GREEN_RATER, PROJECT_TEAM)` OR `GlobalRole.ADMIN`.
- `POST /projects/:projectId/ai-runs?type=PRE_REVIEW` requires `ProjectRoles(REVIEWER)`
  OR `GlobalRole.ADMIN`.
- All GETs require any project membership OR `GlobalRole.ADMIN`.
- Findings ack/ignore: same role rules as the triggering type.

## BR-AI10 — State-lock interaction
- AI runs are READ-ONLY against project state, so the U5 state-lock
  (`UNDER_REVIEW`) does NOT block them.
- The orchestrator does NOT call `StateLockService.assertNotLocked()` for AI
  endpoints.
