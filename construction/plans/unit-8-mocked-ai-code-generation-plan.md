# Unit 8 — Mocked AI — Code Generation Plan

**Cadence**: NFR Requirements + NFR Design SKIPPED for U8 (carried forward from
U3..U7). Tests skipped per the documented PBT deviation (PBT-01 properties FL-18,
FL-19 identified; PBT-02..08, PBT-10 deferred).

**Scope**: stories US-6.1 and US-8.1 — `AiInsightProvider` seam + mock impl +
async in-process runs with polling + ack/ignore on findings + Workbook header
(PRE_SUBMISSION) + Review section (PRE_REVIEW).

**Approach**: Phase A (backend, Steps 1-22) → Phase B (frontend, Steps 23-32) →
Phase C (documentation + validation, Steps 33-38).

---

## Phase A — Backend (Steps 1-22)

### A.1 — Enums + entities

- [x] **1.** Create `src/ai/enums/ai.enums.ts` exporting `AiRunType`, `AiRunStatus`,
      `AiFindingKind`, `AiFindingSeverity`, `AiFindingStatus`. Token constant
      `AI_INSIGHT_PROVIDER`.
- [x] **2.** Create `src/ai/ai-insight-run.entity.ts` (UUID PK, all columns per
      `domain-entities.md`, inherits `AuditBase`, two named indexes).
- [x] **3.** Create `src/ai/ai-insight-finding.entity.ts` (UUID PK, FK to run with
      `onDelete: 'CASCADE'`, all columns, one named index).

### A.2 — DTOs

- [x] **4.** Create `src/ai/dto/ai-insight-run.dto.ts` (`AiInsightRunDto` +
      `AiInsightRunsListDto`).
- [x] **5.** Create `src/ai/dto/ai-insight-finding.dto.ts`.
- [x] **6.** Create `src/ai/dto/start-ai-run.dto.ts` (validation for the `type`
      query parameter via `IsEnum`).

### A.3 — Pure subjects

- [x] **7.** Create `src/ai/findings/findings-generator.ts` exporting:
      - `ProjectSnapshot` + `CreditSnapshot` + `ProvisionalFinding` types
        (re-exported from `domain-entities.md`).
      - `generateAiFindings(snapshot): ProvisionalFinding[]` (FL-18 subject).
      - `sortFindings(list)` — stable sort by `(severity, creditCode, kind)`.
      No Nest imports.

### A.4 — Provider seam + mock impl

- [x] **8.** Create `src/ai/provider/ai-insight.provider.ts`:
      ```ts
      export const AI_INSIGHT_PROVIDER = 'AI_INSIGHT_PROVIDER';
      export interface AiInsightProvider {
        run(snapshot: ProjectSnapshot): Promise<ProvisionalFinding[]>;
      }
      ```
- [x] **9.** Create `src/ai/provider/mock-ai-insight.provider.ts` — wraps
      `generateAiFindings` in `Promise.resolve(...)`.

### A.5 — Snapshot builder

- [x] **10.** Create `src/ai/snapshot/snapshot.builder.ts`. Inject the four repos
      it needs (`ScorecardEntry`, `Submittal`, `VerificationNote`, `Credit`,
      `RatingSystem`). Returns a `ProjectSnapshot` value. No `Date.now()`/`Math.random`
      in the shaping logic (the result must be deterministic given a stable DB).

### A.6 — Executor (the async path)

- [x] **11.** Create `src/ai/ai-insights.executor.ts`. Method `execute(runId)`:
      1. Mark `RUNNING`, audit.
      2. Build snapshot.
      3. Call provider.
      4. Insert findings (batched insert).
      5. Mark `COMPLETED` with summary; audit.
      Wrap the whole body in try/catch — on throw, mark `FAILED` with
      `err.message`; audit.

### A.7 — Orchestrator service

- [x] **12.** Create `src/ai/ai-insights.service.ts`:
      - `start(projectId, type, actor): Promise<AiInsightRunDto>` — BR-AI3 conflict
        check, insert `QUEUED`, schedule `setImmediate`, audit `RUN_QUEUED`, return
        DTO.
      - `getRun(projectId, runId, actor): Promise<AiInsightRunDto>` — eager join
        findings ordered.
      - `listRuns(projectId, type, actor): Promise<AiInsightRunsListDto>` — latest
        20.
      - `ack(projectId, runId, findingId, actor): Promise<AiInsightFindingDto>` —
        BR-AI5 idempotent.
      - `ignore(...)` — symmetric.
      - DTO mappers `toRunDto`, `toFindingDto`.

### A.8 — Controller + module

- [x] **13.** Create `src/ai/ai-insights.controller.ts`. Routes:
      - `POST   /api/v1/projects/:projectId/ai-runs` (body: `{ type }`)
      - `GET    /api/v1/projects/:projectId/ai-runs` (query: `type?`)
      - `GET    /api/v1/projects/:projectId/ai-runs/:runId`
      - `POST   /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/acknowledge`
      - `POST   /api/v1/projects/:projectId/ai-runs/:runId/findings/:findingId/ignore`
      All gated by `ProjectRolesGuard` + `@ProjectRoles('*')`; the service does
      type-specific gating (PRE_SUBMISSION requires GR/PT/Admin; PRE_REVIEW
      requires Reviewer/Admin). Do NOT add a local `@UseGuards(JwtAuthGuard)`
      (carried lesson from U7).
- [x] **14.** Create `src/ai/ai.module.ts`:
      - `TypeOrmModule.forFeature(...)` with the run + finding + snapshot-source
        entities + `ProjectMembership`.
      - Imports: `AuditModule`, `MembershipModule`.
      - Providers: `AiInsightsService`, `AiInsightsExecutor`, `SnapshotBuilder`,
        `{ provide: AI_INSIGHT_PROVIDER, useClass: MockAiInsightProvider }`.
      - Controllers: `AiInsightsController`.

### A.9 — Wiring

- [x] **15.** Update `src/app.module.ts`:
      - Import `AiModule`.
      - Register `AiInsightRun` + `AiInsightFinding` in `TypeOrmModule.forRoot.entities`.

### A.10 — Conflict response shape

- [x] **16.** Define `RunConflictDto` (`{ existingRunId, status }`) inside
      `dto/ai-insight-run.dto.ts`. Service throws `ConflictException` with this body.

### A.11 — Audit hooks

- [x] **17.** All state transitions (`start`, executor entry, executor exit, ack,
      ignore) call `AuditService.write({entity, entityId, action, metadata})`.

### A.12 — Repository wiring sanity

- [x] **18.** Verify that `Submittal`, `VerificationNote`, `ScorecardEntry`,
      `Credit`, `RatingSystem` repos are exported from their modules (or use
      `TypeOrmModule.forFeature` directly inside `AiModule`).

### A.13 — Snapshot edge-cases

- [x] **19.** Snapshot rule: when a `ScorecardEntry` has `attempted=true` but
      `attemptedPoints=0`, treat it as a configuration error — DO NOT include it
      in the missing-evidence calculation; emit a single `ATTENTION_FLAG` with
      `suggestedAction: "Set an attempted point value for {creditCode}."`. (Add
      to BR-AI7 as a "rule 5".)
- [x] **20.** Snapshot rule: portfolio anchors share scorecards with children?
      For U8 we ignore that — runs are always per-project.

### A.14 — Validation

- [x] **21.** Add `class-validator` decorators on `StartAiRunDto.type`
      (`@IsEnum(AiRunType)`).
- [x] **22.** Use `ParseUUIDPipe` on `:runId` and `:findingId` route params.

---

## Phase B — Frontend (Steps 23-32)

### B.1 — DTOs + ApiClient

- [x] **23.** Extend `src/app/core/api/dto.ts` with the U8 shapes (enums as
      string-literal unions; DTOs per `frontend-components.md`).
- [x] **24.** Extend `src/app/core/api/api-client.ts` with the 5 new methods.

### B.2 — Store

- [x] **25.** Create `src/app/features/ai/ai-runs.store.ts` with signals + polling
      logic + ack/ignore methods. Polling pauses on `document.visibilityState ===
      'hidden'`.

### B.3 — Components

- [x] **26.** Create `src/app/features/ai/ai-findings.utils.ts` — `severityColor`,
      `kindLabel`, `severityLabel` helpers.
- [x] **27.** Create `src/app/features/ai/ai-run-button.component.ts` — the
      Run / Analyzing… / Re-run button (Material).
- [x] **28.** Create `src/app/features/ai/ai-findings-panel.component.ts` — the
      grouped panel with per-finding ack/ignore.

### B.4 — Host integration

- [x] **29.** Update `WorkbookPageComponent`:
      - Import `AiRunButtonComponent`, `AiFindingsPanelComponent`.
      - Render the PRE_SUBMISSION header above the tabs (RBAC-aware show).
- [x] **30.** Update `ReviewPageComponent`:
      - Import the two components.
      - Render the PRE_REVIEW section (RBAC-aware show).
- [x] **31.** Add `ai-run-button` styles to `styles.scss` (or local component
      styles).
- [x] **32.** Add the `ai-findings-panel` to BOTH host pages and verify it
      renders on top of existing content with no z-index conflicts.

---

## Phase C — Documentation + Validation (Steps 33-38)

- [x] **33.** Create `aidlc-docs/construction/unit-8-mocked-ai/code/README.md`
      listing files, endpoints, smoke results, scope deviations.
- [x] **34.** Update `usgbc-hub-residential-be/README.md` to "Units 1–8 complete"
      with U8 endpoint quick reference.
- [x] **35.** Update `usgbc-hub-residential-fe/README.md` to "Units 1–8 complete"
      with the AI run-button + panel on Workbook + Review.
- [x] **36.** Update `aidlc-docs/inception/application-design/unit-of-work-story-map.md`:
      mark US-6.1 and US-8.1 as `[x] U8`.
- [x] **37.** Update `aidlc-state.md`: U8 row → FD ✅, NFRR `— (skipped)`,
      NFRD `— (skipped per user)`, CodeGen ✅; Feature → Unit map U8 rows → ✅;
      Current Stage line.
- [x] **38.** Run `npm run build` in both BE + FE; capture clean output.

---

## Story coverage table

| Story | Steps |
|---|---|
| US-6.1 Run completeness/consistency check (mocked) | 1-22 (BE), 23-29 (FE), 31-32 |
| US-8.1 Reviewer pre-review analysis (mocked) | 7, 12-15, 19-20 (snapshot + rule 3), 30 |
| Cross-cutting RBAC | 12, 13 |
| Cross-cutting audit | 11, 12, 17 |
| PBT-01 properties | 7 (FL-18), 12 (FL-19 — ack/ignore idempotence) |
| Documentation | 33-37 |
| Validation | 38 |

---

## PBT compliance for this unit

- **PBT-01** Property identification — COMPLIANT. Two properties documented with
  pure / test-friendly subjects implemented:
  - **FL-18** Finding determinism — pure `generateAiFindings(snapshot)`.
  - **FL-19** Ack/ignore idempotence — service-level invariant.
- **PBT-09** Framework selection — COMPLIANT (fast-check carried over).
- **PBT-02..08, PBT-10** — DOCUMENTED DEVIATION (tests skipped per the U1 precedent).
