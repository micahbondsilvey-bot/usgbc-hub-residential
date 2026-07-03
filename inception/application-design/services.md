# Application Design — Services & Orchestration

Two service tiers: **Domain services** (own one aggregate/concern) and **Orchestration services**
(coordinate multiple domain services for a use case). Orchestration calls domain services directly
(Q7=A). Provider seams isolate external/mocked integrations (Q4=A).

## Domain Services (by unit)

| Service | Owns | Key Responsibility |
|---|---|---|
| AuthService | authentication | Login, token resolution, profile |
| UsersService | User | Identity, global role, profile, seeding |
| ProjectMembershipService | ProjectMembership/Invitation | Per-project roles, invites (Q1=C) |
| AuditService | audit | Timestamps + change records (cross-cutting) |
| CatalogService | RatingSystem/Credit | Real LEED v4.1 SF catalog (relational) |
| ScorecardService | ScorecardEntry | Toggles, point entry, summary (authoritative) |
| ProjectsService | Project/Agreement | Registration, edits, project number |
| Fees/InvoiceService | Invoice | Fee logic, invoice, payment intent |
| WorkbookService | FieldVerification/Submittal/Note | Slots, uploads, three-column notes |
| ReviewService | Review/Decision | Phases, decisions, awards, state transitions |
| ReviewReportService | ReviewReport | Auto-generate report |
| QualityScoreService | QualityScore | Enter (authoritative) + revise |
| StateLockService | project lock state | UNDER_REVIEW enforcement (Admin bypass) |
| PortfolioService | anchor/child | Hierarchy, portfolio view, batch |
| DashboardService | read models | Role-tailored aggregations + reviewer assignment |
| NotificationService | Notification | Event notifications (mock delivery) |
| AiInsightService | AiInsight | Async (in-process) checks + acknowledge |

## Provider Seams (interface + mock/local impl, config-selected)

| Seam Interface | This-build impl | Future impl |
|---|---|---|
| `PaymentProvider` | MockPaymentProvider (intent only) | Stripe |
| `FileStorageProvider` | LocalFileStorageProvider (S3-compatible API) | AWS S3 + presigned URLs |
| `NotificationProvider` | LogNotificationProvider (logged/mock) | SMTP/email provider |
| `AiInsightProvider` | MockAiInsightProvider (realistic stubs) | Python FastAPI + LLM/RAG |
| `SchedulingProvider` | MockSchedulingProvider (stub link) | MS Bookings |

## Orchestration Services

### RegistrationOrchestrator
Coordinates: ProjectsService → FeeCalculator/InvoiceService → PaymentProvider(intent) →
ProjectsService.assignProjectNumber → NotificationService.
- **Rule gate**: project number is issued only after pay/commit + invoice (FR-2.5/2.7).

### SubmissionOrchestrator
Coordinates: ReviewService.submitForReview (phase rules) → StateLockService.lock → NotificationService.
- **Rule gate**: Preliminary precedes Final; Final skippable if prelim fully awarded (FR-7.1).

### ReviewReturnOrchestrator
Coordinates: ReviewService finalize → ReviewReportService.autoGenerate →
ReviewService.returnToReviewer (confirm) → ReviewService.releaseToGreenRater →
StateLockService.release → NotificationService → SchedulingProvider (optional).
- **Rule gate**: results to reviewer first, then green rater (FR-7.6).

### PortfolioSubmissionOrchestrator
Coordinates: PortfolioService + SubmissionOrchestrator per project.
- **Rule gate**: anchor failure cascades to all children (FR-7.3).

## Cross-Cutting

- **AuditService** applied via interceptor/entity subscriber across mutating operations.
- **RBAC** via `JwtAuthGuard` (global) + `ProjectRolesGuard` (project-scoped); Admin global bypass.
- **Logging/exception/middleware**: reuse existing CommonModule.
