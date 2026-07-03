# Application Design — Component Methods

Method signatures with input/output types (TypeScript-style). **Business rules are detailed later in
Functional Design (per unit).** Types are indicative, not final.

---

## Unit 1 — Platform Foundation

### AuthService
- `login(email: string, password: string): Promise<{ accessToken: string; profile: ProfileDto }>`
- `resolveUser(token?: string): Promise<AuthUser>` — global identity + global role
- `getProfile(user: AuthUser): Promise<ProfileDto>`

### RolesGuard / ProjectRolesGuard
- `canActivate(ctx): boolean | Promise<boolean>` — global Admin OR required project role on the
  target project id (resolved from route/membership).

### UsersService
- `createUser(input: CreateUserInput): Promise<User>`
- `findById(id: string): Promise<User | null>`
- `findByEmail(email: string): Promise<User | null>`
- `updateProfile(id: string, patch: ProfilePatch): Promise<User>`
- `validateCredentials(email: string, password: string): Promise<User | null>`
- `seedDemoAccounts(): Promise<void>`

### ProjectMembershipService
- `addMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMembership>`
- `invite(projectId: string, email: string, role: ProjectRole, invitedBy: string): Promise<Invitation>`
- `acceptInvitation(token: string, userId: string): Promise<ProjectMembership>`
- `getRoleOnProject(userId: string, projectId: string): Promise<ProjectRole | null>`
- `listMembers(projectId: string): Promise<ProjectMembership[]>`

### AuditService
- `stamp<T>(entity: T, actorId: string): T` — set created/updated/modified_by
- `record(change: AuditChange): Promise<void>` — status/score/note change log

---

## Unit 2 — Catalog & Scorecard

### CatalogService
- `getRatingSystem(id: string): Promise<RatingSystem>`
- `listCredits(ratingSystemId: string): Promise<Credit[]>`
- `seedLeedV41Sf(): Promise<void>` — load real catalog from provided source data

### ScorecardSummaryCalculator (pure — PBT target)
- `computeCategoryTotals(entries: ScorecardEntry[], catalog: Credit[]): CategoryTotals`
- `computeOverall(totals: CategoryTotals): { attempted: number; verified: number; awarded: number }`
- `deriveCertificationLevel(awarded: number): CertificationLevel`
- `validateEntry(entry: ScorecardEntry, credit: Credit): ValidationFlags` — flags out-of-range (no reject)

### ScorecardService
- `getScorecard(projectId: string): Promise<ScorecardDto>`
- `setAttempted(projectId: string, creditId: string, attempted: boolean): Promise<ScorecardEntry>`
- `setPoints(projectId: string, creditId: string, points: PointEntry): Promise<ScorecardEntry>`
- `getSummary(projectId: string): Promise<SummaryDto>` — server-authoritative

---

## Unit 3 — Registration & Fees

### ProjectsService
- `register(input: RegisterProjectInput, actor: AuthUser): Promise<Project>` — draft (pre-number)
- `editDetails(projectId: string, patch: ProjectDetailsPatch, actor: AuthUser): Promise<Project>` — non-fee fields
- `getProject(projectId: string): Promise<Project>`
- `assignProjectNumber(projectId: string): Promise<string>` — called post-payment by orchestrator

### ProjectNumberGenerator
- `next(): Promise<string>` — unique `RES-#####`, collision-free

### BulkRegistrationParser
- `parse(file: Buffer): { valid: ParsedRow[]; errors: RowError[] }`
- `serialize(rows: ParsedRow[]): Buffer` — round-trip (PBT target)
- `dedupeKey(row: ParsedRow): string` — idempotent re-upload identity

### FeeCalculator (pure — PBT target)
- `compute(input: FeeInput): FeeBreakdown` — non-negative, bounded discounts (invariants)

### InvoiceService
- `generate(projectId: string, fees: FeeBreakdown, intent: 'pay_now' | 'pay_later'): Promise<Invoice>`
- `getInvoice(projectId: string): Promise<Invoice>`

### PaymentProvider (seam — mock)
- `recordIntent(invoiceId: string, intent: PaymentIntent): Promise<PaymentRecord>` (no real charge)

---

## Unit 4 — Workbook

### WorkbookService
- `syncSlotsForCredit(projectId: string, creditId: string, attempted: boolean): Promise<void>` — binding
- `getCreditDetail(projectId: string, creditId: string): Promise<CreditDetailDto>`
- `saveFieldVerification(projectId, creditId, data: FieldVerificationInput): Promise<FieldVerificationEntry>`
- `addSubmittal(projectId, creditId, slot: string, file: UploadedFile): Promise<Submittal>`
- `saveNote(projectId, creditId, column: 'green_rater'|'provider_qc'|'reviewer', text: string, actor): Promise<VerificationNote>`

### FileStorageProvider (seam — local S3-compatible)
- `put(key: string, file: UploadedFile): Promise<{ key: string }>`
- `getSignedUrl(key: string, ttlSeconds: number): Promise<string>`
- `delete(key: string): Promise<void>`

---

## Unit 5 — Review Workflow & State-Locking

### ReviewService
- `submitForReview(projectId: string, phase: ReviewPhaseType, actor: AuthUser): Promise<Review>`
  - enforces: Preliminary before Final; Final skippable if prelim fully awarded
- `recordDecision(reviewId: string, creditId: string, awarded: number, actor): Promise<CreditDecision>`
- `awardAllVerified(reviewId: string, actor): Promise<CreditDecision[]>`
- `returnToReviewer(reviewId: string): Promise<Review>` — reviewer confirmation step first
- `releaseToGreenRater(reviewId: string): Promise<Review>`
- `respond(projectId: string, decision: 'accept' | 'continue', actor): Promise<Project>`

### ReviewReportService
- `autoGenerate(reviewId: string): Promise<ReviewReport>` — system-generated (not uploaded)

### QualityScoreService
- `enter(projectId: string, score: QualityScoreInput, actor): Promise<QualityScore>` — authoritative on entry
- `revise(scoreId: string, score: QualityScoreInput, actor): Promise<QualityScore>` — reviewer or admin

### StateLockService
- `lock(projectId: string): Promise<void>` — set `UNDER_REVIEW`
- `release(projectId: string): Promise<void>`
- `assertWritable(projectId: string, actor: AuthUser): void` — throws if locked (Admin bypass)
- (Stateful PBT target: legal transitions only)

---

## Unit 6 — Portfolio

### PortfolioService
- `designateAnchor(projectId: string): Promise<Project>`
- `attachChild(anchorId: string, childId: string): Promise<Project>`
- `getPortfolio(anchorId: string): Promise<PortfolioDto>`
- `batchSubmit(anchorId: string, actor): Promise<BatchResult>` — anchor failure cascades to children

---

## Unit 7 — Dashboards & Notifications

### DashboardService
- `projectDashboard(userId: string): Promise<ProjectDashboardDto>`
- `greenRaterDashboard(userId: string): Promise<GreenRaterDashboardDto>`
- `reviewerDashboard(userId: string): Promise<ReviewerDashboardDto>`
- `adminPipeline(): Promise<AdminPipelineDto>`
- `assignReviewer(projectId: string, reviewerId: string, actor): Promise<void>`

### NotificationService
- `notify(event: NotificationEvent): Promise<Notification>` — persists + delivers via provider
- `listForUser(userId: string): Promise<Notification[]>`

### NotificationProvider (seam — mock)
- `send(message: NotificationMessage): Promise<DeliveryResult>` (logged/mock)

---

## Unit 8 — Mocked AI

### AiInsightService
- `startCheck(projectId: string, type: 'completeness'|'consistency'|'pre_review', actor): Promise<{ checkId: string }>`
- `getCheck(checkId: string): Promise<AiCheckResult>` — status + findings (poll)
- `acknowledge(insightId: string, action: 'accept'|'ignore', actor): Promise<AiInsight>`

### AiInsightProvider (seam — mock)
- `analyze(input: AiAnalysisInput): Promise<AiFinding[]>` — realistic stubbed findings + suggested actions

---

## Unit 9 — Scheduling (Mobile/PWA mostly frontend)

### SchedulingProvider (seam — mock/link-out)
- `createBookingLink(context: BookingContext): Promise<{ url: string }>`

---

## Orchestration Services (service layer — Q7=A)

### RegistrationOrchestrator
- `completeRegistration(input, actor): Promise<{ project: Project; invoice: Invoice }>`
  - register → fee compute → invoice → assign project number → registration-confirmation notification

### SubmissionOrchestrator
- `submit(projectId, phase, actor): Promise<Review>`
  - validate phase rules → state-lock → create review → notify

### ReviewReturnOrchestrator
- `returnReview(reviewId, actor): Promise<void>`
  - finalize decisions → auto-generate report → return to reviewer (confirm) → release to green rater
    → release state-lock → notify → optional scheduling link

### PortfolioSubmissionOrchestrator
- `submitPortfolio(anchorId, actor): Promise<BatchResult>`
  - submit anchor first; on anchor failure, fail all children; else submit children
