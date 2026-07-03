# Unit 8 — Domain Entities

Tech-agnostic domain model for the Mocked AI unit. **Two new tables** —
`ai_insight_run` and `ai_insight_finding` — plus a pure `ProjectSnapshot` value and a
`ProvisionalFinding` shape that the mocked `AiInsightProvider` returns.

Decisions reflected (all-A from `unit-8-mocked-ai-design-plan.md`):
- Q1=A `AiInsightProvider` interface + `MockAiInsightProvider` impl behind the
  `AI_INSIGHT_PROVIDER` token.
- Q2=A run lifecycle persisted + status-polled.
- Q4=A finding kinds + severity + acknowledged/ignored.
- Q6=A two tables with `AuditBase`.
- Q7=A deterministic pure function over `ProjectSnapshot`.

---

## AiInsightRun

One row per "run" started by a user.

- `id: UUID` (PK).
- `projectId: UUID` — soft FK to `project.id`.
- `type: AiRunType` enum — `PRE_SUBMISSION | PRE_REVIEW`.
- `status: AiRunStatus` enum — `QUEUED | RUNNING | COMPLETED | FAILED`.
- `ranByUserId: UUID` — actor at the start of the run.
- `ranByGlobalRole: GlobalRole` — captured at start for audit.
- `startedAt: timestamptz` — server clock at insert.
- `completedAt: timestamptz | null` — set on success or failure.
- `failureReason: text | null` — for `FAILED` runs.
- `summary: jsonb` — `{ findingCountByKind: {...}, findingCountBySeverity: {...} }`
- `version: int` — increments on each status transition.
- inherits `AuditBase`.

Indexes:
- `ai_insight_run_project_idx` on `(projectId, startedAt DESC)` — list latest runs.
- `ai_insight_run_project_type_idx` on `(projectId, type, completedAt DESC)` —
  status-polling and "is there a run currently RUNNING" query.

Concurrency invariant (BR-AI3): at most one `RUNNING` row per `(projectId, type)` —
enforced at the service layer (no DB unique constraint to keep schema simple; the orchestrator
does a `SELECT ... FOR UPDATE` before insert).

---

## AiInsightFinding

One row per finding inside a run. A run produces zero or more findings; a `COMPLETED`
run with zero findings is a normal "all clear" outcome.

- `id: UUID` (PK).
- `runId: UUID` — FK to `ai_insight_run.id` with `ON DELETE CASCADE` semantics
  (TypeORM `onDelete: 'CASCADE'`).
- `kind: AiFindingKind` enum — `MISSING_EVIDENCE | INSUFFICIENT_EVIDENCE |
  CROSS_CREDIT_CONTRADICTION | ATTENTION_FLAG`.
- `severity: AiFindingSeverity` enum — `HIGH | MEDIUM | LOW`.
- `creditId: UUID | null` — null for portfolio/cross-cutting (e.g. CROSS_CREDIT_CONTRADICTION).
- `creditCode: text | null` — denormalized for stable sort + zero-join FE rendering
  (e.g. `EAp1`).
- `title: text` — short headline, <= 120 chars.
- `description: text` — 1–3 sentence rationale.
- `suggestedAction: text` — explicit next step (BR-AI4: required and not just a flag).
- `status: AiFindingStatus` enum — `NEW | ACKNOWLEDGED | IGNORED`.
- `acknowledgedAt: timestamptz | null`.
- `acknowledgedByUserId: UUID | null`.
- `ignoredAt: timestamptz | null`.
- `ignoredByUserId: UUID | null`.
- `version: int` — LWW.
- inherits `AuditBase`.

Indexes:
- `ai_insight_finding_run_idx` on `(runId, severity, creditCode)` — for the FE list.

---

## AiRunType / AiRunStatus / AiFindingKind / AiFindingSeverity / AiFindingStatus

```ts
export enum AiRunType {
  PRE_SUBMISSION = 'PRE_SUBMISSION',
  PRE_REVIEW = 'PRE_REVIEW',
}

export enum AiRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AiFindingKind {
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
  INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE',
  CROSS_CREDIT_CONTRADICTION = 'CROSS_CREDIT_CONTRADICTION',
  ATTENTION_FLAG = 'ATTENTION_FLAG',
}

export enum AiFindingSeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum AiFindingStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IGNORED = 'IGNORED',
}
```

---

## ProjectSnapshot (pure-function input)

The mocked provider receives a value-only snapshot of the project state. No
ORM entities, no IDs of services. Built by `AiInsightsService.buildSnapshot(projectId)`.

```ts
export interface CreditSnapshot {
  creditId: string;
  creditCode: string;          // 'EAp1', 'EAc1', ...
  isPrerequisite: boolean;
  attempted: boolean;
  attemptedPoints: number;     // BR-S1 invariant: ≥ 0
  verifiedPoints: number;      // BR-S2
  awardedPoints: number;       // BR-S3
  submittalCount: number;      // count of `submittal` rows under this credit
  hasGreenRaterNote: boolean;  // VerificationNote.author = GREEN_RATER && body length > 0
  hasProviderNote: boolean;
  hasReviewerNote: boolean;
}

export interface ProjectSnapshot {
  projectId: string;
  ratingSystemMaxPoints: number;   // e.g. 110 for LEED v4.1 SF
  type: AiRunType;
  credits: CreditSnapshot[];
}
```

---

## ProvisionalFinding (pure-function output)

```ts
export interface ProvisionalFinding {
  kind: AiFindingKind;
  severity: AiFindingSeverity;
  creditId: string | null;
  creditCode: string | null;
  title: string;
  description: string;
  suggestedAction: string;
}
```

`generateAiFindings(snapshot: ProjectSnapshot): ProvisionalFinding[]` is the FL-18 PBT-01
subject — pure, no I/O, no `Date`/`Math.random`. Ordering: `severity DESC` (HIGH first)
then `creditCode ASC` then `kind ASC`.

---

## AiInsightProvider seam

```ts
export const AI_INSIGHT_PROVIDER = 'AI_INSIGHT_PROVIDER';

export interface AiInsightProvider {
  run(snapshot: ProjectSnapshot): Promise<ProvisionalFinding[]>;
}
```

The interface is asynchronous so a future real provider can call an LLM. The mock
implementation is synchronous internally and returns immediately, but wraps the result
in `Promise.resolve(...)` to honor the contract.

---

## AiInsightRunDto / AiInsightFindingDto (wire shape)

```ts
export interface AiInsightFindingDto {
  id: string;
  runId: string;
  kind: AiFindingKind;
  severity: AiFindingSeverity;
  creditId: string | null;
  creditCode: string | null;
  title: string;
  description: string;
  suggestedAction: string;
  status: AiFindingStatus;
  acknowledgedAt: string | null;
  ignoredAt: string | null;
  version: number;
}

export interface AiInsightRunDto {
  id: string;
  projectId: string;
  type: AiRunType;
  status: AiRunStatus;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  summary: {
    findingCountByKind: Partial<Record<AiFindingKind, number>>;
    findingCountBySeverity: Partial<Record<AiFindingSeverity, number>>;
    totalFindings: number;
  };
  ranByUserId: string;
  findings?: AiInsightFindingDto[]; // hydrated for GET /:runId; omitted from list responses
}

export interface AiInsightRunsListDto {
  runs: AiInsightRunDto[];
}
```

---

## Forward-compat (NOT implemented this build)

- **Real LLM provider** behind the `AI_INSIGHT_PROVIDER` token. Schema is already
  channel-agnostic; the swap is a single `useClass` change in `AiModule`.
- **Webhooks / push** for completion (instead of FE polling).
- **Per-finding comment threads** — only ack/ignore in this build.
- **Re-run on a single credit** — runs are always project-scoped.

## Sequences / DDL

No new sequences. Both tables use `@PrimaryGeneratedColumn('uuid')`. Three indexes
added in the entity decorators; TypeORM `synchronize: true` creates them on boot.
