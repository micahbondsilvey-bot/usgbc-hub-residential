# Unit 8 — Mocked AI — Code (Brownfield)

Implementation summary for Unit 8. Tests skipped per the documented PBT
deviation carried forward from Unit 1; FL-18 (finding determinism) and FL-19
(ack/ignore idempotence) properties identified.

## Files

### Backend (`usgbc-hub-residential-be/src/ai/`)
- `enums/ai.enums.ts` — `AiRunType`, `AiRunStatus`, `AiFindingKind`,
  `AiFindingSeverity`, `AiFindingStatus`, `AI_INSIGHT_PROVIDER` token.
- `ai-insight-run.entity.ts` — `ai_insight_run` table (+ 2 indexes).
- `ai-insight-finding.entity.ts` — `ai_insight_finding` table (+ 1 index,
  FK to run with `ON DELETE CASCADE`).
- `dto/ai-insight-run.dto.ts`, `dto/ai-insight-finding.dto.ts`,
  `dto/start-ai-run.dto.ts` — wire DTOs.
- `findings/findings-generator.ts` — **pure** `generateAiFindings(snapshot)`
  + `compareFindings` + `sortFindings`. PBT subject **FL-18**.
- `provider/ai-insight.provider.ts` — interface + `AI_INSIGHT_PROVIDER` token.
- `provider/mock-ai-insight.provider.ts` — `useClass` binding.
- `snapshot/snapshot.builder.ts` — `SnapshotBuilder.build(projectId, type)`
  reads scorecard + workbook + submittals + verification notes + rating
  system and shapes a deterministic `ProjectSnapshot` value.
- `ai-insights.executor.ts` — async fire-and-forget executor for one run.
  Handles `QUEUED → RUNNING → COMPLETED|FAILED` transitions + audit.
- `ai-insights.service.ts` — orchestrator: `start`, `getRun`, `listRuns`,
  `acknowledge`, `ignore` (BR-AI5 idempotent), RBAC gating per (run type ↔
  project role).
- `ai-insights.controller.ts` — 5 routes under `projects/:projectId/ai-runs`.
- `ai.module.ts` — wiring.

### Backend (modified)
- `app.module.ts` — imports `AiModule`, registers `AiInsightRun` +
  `AiInsightFinding` entities.

### Frontend (`usgbc-hub-residential-fe/src/app/features/ai/`)
- `ai-runs.store.ts` — signal-backed store with per-(projectId, type) polling.
- `ai-findings.utils.ts` — severity labels/colors, kind labels.
- `ai-run-button.component.ts` — Run / Analyzing… / Re-run button.
- `ai-findings-panel.component.ts` — grouped panel with ack/ignore.

### Frontend (modified)
- `core/api/dto.ts` — adds 5 enums + 4 DTOs.
- `core/api/api-client.ts` — adds 5 methods.
- `features/workbook/workbook-page.component.ts` — embeds PRE_SUBMISSION
  AI run button + findings panel above the tabs.
- `features/review/review-page.component.ts` — embeds PRE_REVIEW AI run
  button + findings panel under the page header.

## Endpoints

```
POST   /api/v1/projects/:projectId/ai-runs          (body: { type })          → 202 AiInsightRunDto
GET    /api/v1/projects/:projectId/ai-runs           (?type=PRE_SUBMISSION)   → AiInsightRunsListDto
GET    /api/v1/projects/:projectId/ai-runs/:runId                              → AiInsightRunDto (with findings[])
POST   /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/acknowledge → AiInsightFindingDto
POST   /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/ignore     → AiInsightFindingDto
```

All routes are gated by `ProjectRolesGuard` (`@ProjectRoles('*')`). The
service performs type-specific RBAC:
- `PRE_SUBMISSION` start / ack requires `GREEN_RATER`, `PROJECT_TEAM`, or
  `GlobalRole.ADMIN`.
- `PRE_REVIEW` start / ack requires `REVIEWER` or `GlobalRole.ADMIN`.

## Run lifecycle

```
QUEUED (insert) ──setImmediate──▶ RUNNING ──provider.run──▶ COMPLETED
                                          └─ on throw ──▶ FAILED
```

- **BR-AI3** — at most one in-flight run per `(projectId, type)`. Second
  start returns `409 Conflict` with `{ existingRunId, status }`.
- **BR-AI5** — ack/ignore is idempotent (no audit row on second call, no
  version bump).

## PBT compliance

- **FL-18** Finding determinism — pure `generateAiFindings(snapshot)` in
  `src/ai/findings/findings-generator.ts`. Same `ProjectSnapshot` ⇒ same
  ordered `ProvisionalFinding[]`. No `Date.now()` / `Math.random()`.
- **FL-19** Ack/ignore idempotence — service-level invariant. Second call
  is a no-op.
- **PBT-09** Framework — fast-check carried over.
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per U1
  precedent).

## Scope deviations

- No real LLM. The `AiInsightProvider` seam is bound to `MockAiInsightProvider`
  via `useClass`. A future real impl swaps `useClass` in `AiModule`.
- No WebSocket push. FE polls every 2s via `setInterval` (paused when
  document is hidden).
- No per-finding comment threads. Only ack/ignore.

## Validation

- `tsc --noEmit` clean on all U8 BE files.
- `nest build` clean.
- `ng build` clean (FE).
- `get_diagnostics` clean on all new + modified files.
