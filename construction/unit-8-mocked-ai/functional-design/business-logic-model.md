# Unit 8 — Business Logic Model

Module layout, orchestration flows, and pure subjects for Unit 8 (Mocked AI).

---

## Module map

```
src/ai/
├── ai.module.ts
├── ai-insights.service.ts          (orchestrator: lifecycle + snapshot + persistence)
├── ai-insights.controller.ts        (REST surface)
├── ai-insights.executor.ts          (the setImmediate-scheduled async work)
├── snapshot/
│   └── snapshot.builder.ts          (pure-ish: TypeORM reads, then synchronous shaping)
├── provider/
│   ├── ai-insight.provider.ts       (interface + injection token)
│   └── mock-ai-insight.provider.ts  (impl)
├── findings/
│   └── findings-generator.ts        (PURE — `generateAiFindings(snapshot)` — FL-18)
├── enums/
│   └── ai.enums.ts
├── ai-insight-run.entity.ts
├── ai-insight-finding.entity.ts
└── dto/
    ├── ai-insight-run.dto.ts
    ├── ai-insight-finding.dto.ts
    ├── start-ai-run.dto.ts
    └── ai-runs-list.dto.ts
```

`AiModule` exports nothing — it's a leaf module. `app.module.ts` imports it; the
two entities are registered in `TypeOrmModule.forRoot.entities`.

---

## Flow 1 — Start a run (`POST /api/v1/projects/:projectId/ai-runs?type=...`)

```mermaid
sequenceDiagram
    actor Actor
    participant C as AiInsightsController
    participant S as AiInsightsService
    participant R as Repository<AiInsightRun>
    participant E as AiInsightsExecutor
    participant P as MockAiInsightProvider
    participant F as Repository<AiInsightFinding>

    Actor->>C: POST /projects/{id}/ai-runs?type=PRE_SUBMISSION
    C->>S: start(projectId, type, actor)
    S->>R: SELECT in-flight for (project, type)
    R-->>S: 0 rows
    S->>R: INSERT run (QUEUED)
    S->>S: schedule setImmediate(() => E.execute(runId))
    S-->>C: AiInsightRunDto (status=QUEUED)
    C-->>Actor: 202 Accepted

    Note over E: async, fire-and-forget
    E->>R: UPDATE run -> RUNNING
    E->>S: buildSnapshot(projectId, type) (reads scorecard, workbook, submittals, notes)
    E->>P: run(snapshot)
    P->>P: generateAiFindings(snapshot)  // PURE
    P-->>E: ProvisionalFinding[]
    E->>F: INSERT findings rows (in order)
    E->>R: UPDATE run -> COMPLETED + summary
```

Text alternative:
1. Controller `start` after BR-AI3 conflict check.
2. Insert run as `QUEUED`, schedule `setImmediate` to call the executor, return 202.
3. Executor flips to `RUNNING`, builds snapshot, calls provider (pure
   `generateAiFindings`), inserts findings preserving order, flips to `COMPLETED`.
4. On any thrown error, flips to `FAILED` with `failureReason`.

## Flow 2 — Poll status (`GET /api/v1/projects/:projectId/ai-runs/:runId`)

1. Authorize: actor must be a member of `projectId` or `GlobalRole.ADMIN`.
2. Fetch the run + LEFT JOIN its findings (ordered by severity/creditCode).
3. Compose `AiInsightRunDto` including `findings[]` (always present for the
   single-run GET, even if empty).
4. FE polls at 2s intervals while `status in (QUEUED, RUNNING)`; stops polling on
   `COMPLETED` or `FAILED`.

## Flow 3 — List runs (`GET /api/v1/projects/:projectId/ai-runs`)

- Optional `type` query parameter to filter; otherwise both run types returned.
- Latest 20 rows by default, ordered by `startedAt DESC`.
- Findings NOT included (FE re-fetches per-run if it wants the detail).

## Flow 4 — Acknowledge a finding (`POST .../findings/:findingId/acknowledge`)

```mermaid
sequenceDiagram
    actor Actor
    participant C as AiInsightsController
    participant S as AiInsightsService
    participant F as Repository<AiInsightFinding>

    Actor->>C: POST /findings/{id}/acknowledge
    C->>S: ack(projectId, findingId, actor)
    S->>F: SELECT finding
    F-->>S: row (status=NEW)
    alt status === NEW
        S->>F: UPDATE status=ACKNOWLEDGED, acknowledgedAt=NOW, version+1
    else status !== NEW
        S->>S: no-op (FL-19 idempotence)
    end
    S->>S: audit(FINDING_ACKNOWLEDGED)
    S-->>C: AiInsightFindingDto
    C-->>Actor: 200 OK
```

## Flow 5 — Ignore a finding

Symmetric with Flow 4 but uses `IGNORED` status and `ignoredAt` column.

---

## Pure subjects

### `generateAiFindings(snapshot: ProjectSnapshot): ProvisionalFinding[]`

Lives in `src/ai/findings/findings-generator.ts`. No Nest imports. Pure.

Property **FL-18 — finding determinism**: For all snapshots `s`,
`generateAiFindings(s) == generateAiFindings(s)` (deep-equal arrays).

Algorithm:
```ts
const out: ProvisionalFinding[] = [];

for (const c of snapshot.credits) {
  if (!c.attempted) continue;
  if (c.submittalCount === 0) {
    out.push({ kind: MISSING_EVIDENCE, severity: HIGH, ... });
  } else if (!c.hasGreenRaterNote) {
    out.push({ kind: INSUFFICIENT_EVIDENCE, severity: MEDIUM, ... });
  }
}

if (snapshot.type === 'PRE_REVIEW') {
  for (const c of snapshot.credits) {
    if (!c.attempted) continue;
    if (c.awardedPoints < c.verifiedPoints) {
      out.push({ kind: ATTENTION_FLAG, severity: LOW, ... });
    }
  }
}

const total = snapshot.credits
  .filter(c => c.attempted)
  .reduce((a, c) => a + c.attemptedPoints, 0);
if (total > snapshot.ratingSystemMaxPoints) {
  out.push({ kind: CROSS_CREDIT_CONTRADICTION, severity: HIGH, creditId: null, ... });
}

return sortFindings(out);
```

`sortFindings` is a stable sort by `(severity, creditCode || '\uffff', kind)`.

### Ack/ignore idempotence (FL-19)

The service's `ack(findingId)` and `ignore(findingId)` are state-machine transitions
gated on `status === NEW`. The pure subject is the predicate `canTransition(current,
target)` — implemented inline in the service for simplicity; the PBT property is on
the service flow (run `ack` twice; second call returns same DTO with no audit row
appended for "second" call).

---

## Snapshot builder

`buildSnapshot(projectId, type)` performs three reads:
1. `ScorecardEntry[]` + `Credit[]` join (one query) — sourced from U2.
2. `Submittal[]` grouped by `creditId` — sourced from U4.
3. `VerificationNote[]` grouped by `(creditId, author)` — sourced from U4.

Then shapes them into `CreditSnapshot[]` in-memory. The rating system's
`maxPoints` is taken from the seeded `RatingSystem` row (`type === 'LEED_v4.1_SF'`
→ `110`).

The builder is **not pure** because it reads from the DB, but it has no side
effects and is deterministic given a stable DB.

---

## Module wiring

`AiModule.imports`:
- `TypeOrmModule.forFeature([AiInsightRun, AiInsightFinding, ScorecardEntry,
  WorkbookFieldEntry, Submittal, VerificationNote, Credit, RatingSystem,
  ProjectMembership])`
- `AuditModule`
- `MembershipModule` (for `ProjectRolesGuard`)

`AiModule.providers`:
- `AiInsightsService`
- `AiInsightsExecutor`
- `SnapshotBuilder`
- `{ provide: AI_INSIGHT_PROVIDER, useClass: MockAiInsightProvider }`

`AiModule.controllers`:
- `AiInsightsController` (uses `ProjectRolesGuard` + `@CurrentUser()`).

`app.module.ts` imports `AiModule` and registers the two new entities.

---

## Error handling

| Error | HTTP | Notes |
|---|---|---|
| Project not found | 404 | Same as other modules |
| RBAC denied | 403 | `ProjectRolesGuard` standard |
| In-flight run conflict (BR-AI3) | 409 | Body: `{ existingRunId, status }` |
| Invalid `type` query | 400 | Pipe validation |
| Provider throws | run → `FAILED` | Async; status visible via polling |
| Findings ack on already-ack'd | 200 | Idempotent (BR-AI5) |
