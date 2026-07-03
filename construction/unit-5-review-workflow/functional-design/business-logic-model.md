# Unit 5 — Business Logic Model

End-to-end orchestration for Review Workflow & State-Locking. Tech-agnostic narratives + the
property-based-testing (PBT-01) targets.

---

## BL-1 SubmissionOrchestrator — `submit(...)` (US-7.1, BR-RW2)

```text
1. assertReader (member or Admin); reject Reviewer self-submit.
2. project = ProjectsService.getById(projectId)
3. assertEligible(project, phase):
   - project.status === REGISTERED
   - For FINAL: priorPrelim.status = RETURNED AND outcome ∈ {PASSED, PASSED_WITH_ISSUES}
   - For SUPPLEMENTAL: priorFinal.status = RETURNED AND outcome = PASSED_WITH_ISSUES
   - Project has at least one attempted credit
4. existing = Review.find({ projectId, phase })
5. dataSource.transaction:
   a. If existing && existing.status === RETURNED:
        // Re-submit path (BR-RW8): mutate the existing row.
        existing.status = SUBMITTED
        existing.submittedAt = NOW()
        existing.submittedByUserId = actor.id
        existing.outcome = null
        existing.confirmedAt = existing.returnedAt = null
        existing.confirmedByUserId = existing.returnedByUserId = null
        existing.reportMarkdown = existing.reportGeneratedAt = null
        review = save(existing)
      Else if existing:
        throw 409 ("a review for this phase is already in progress")
      Else:
        review = Review.create({
          displayId: ReviewNumberGenerator.allocate(),
          projectId, phase,
          status: SUBMITTED, submittedAt: NOW(), submittedByUserId: actor.id,
          version: 1
        }); save.
   b. ProjectsService.transitionStatus(project, UNDER_REVIEW, actor.id)
   c. AuditService.record('Review.submitted', { phase, displayId })
6. Post-commit: NotificationGateway.send({ kind: 'submission-confirmed', ... })  // best-effort
```

Failure modes:
- assertEligible 409 → no transaction.
- transitionStatus throws (illegal status) → transaction rolls back.

---

## BL-2 Award decisions

### `setAwarded(projectId, creditId, awardedPoints, actor)` (BR-RW4)

```text
1. assertWriter (Reviewer membership or Admin)  // U2's COLUMN_WRITERS, awardedPoints column
2. assertWritable(projectId, actor)              // BR-Z1 — Admin bypass; UNDER_REVIEW required
3. credit = Credit.findById(creditId)
4. entry = ScorecardEntry.findOne({ projectId, creditId }); reject if missing
5. assert 0 ≤ awardedPoints ≤ entry.verifiedPoints  (FL-9 hard invariant)
6. transaction:
   a. entry.awardedPoints = awardedPoints; entry.version++;
      AuditStampHelper.stampUpdate(entry, actor.id); save.
   b. review = Review.find({ projectId, status IN [SUBMITTED, DECIDED] }).first
      if !review → 409 ("no open review")
   c. if review.status === SUBMITTED:
        ReviewStatusTransition.assertTransition(SUBMITTED, DECIDED)
        review.status = DECIDED
      review.reviewedByUserId = actor.id
      review.decidedAt = NOW()
      review.version++; save.
   d. AuditService.record('ScorecardEntry.awarded', { creditId, before, after })
```

### `awardAllVerified(projectId, reviewId, actor)` (BR-RW4)

```text
1. assertWriter (Reviewer membership or Admin)
2. assertWritable(projectId, actor)
3. review = Review.findOne({ id: reviewId, projectId })
4. assert review.status ∈ {SUBMITTED, DECIDED}
5. entries = ScorecardEntry.find({ projectId, attempted: true })
6. transaction:
   a. updatedCount = 0
   b. for each entry:
        if entry.awardedPoints !== entry.verifiedPoints:
          entry.awardedPoints = entry.verifiedPoints
          entry.version++; AuditStampHelper.stampUpdate(entry, actor.id); save.
          updatedCount++
   c. if review.status === SUBMITTED:
        review.status = DECIDED  // bulk decide path
      review.reviewedByUserId ??= actor.id
      review.decidedAt = NOW(); review.version++; save.
   d. AuditService.record('Review.awardAllVerified', { reviewId, updatedCount })
7. Return { updatedCount, summary }
```

Idempotence (FL-11 PBT-01 target): re-running this method on the same review without any
external scorecard changes results in `updatedCount = 0` and no version churn beyond the
single review row's version bump. (The review row's version still bumps each time; entries
do not.)

---

## BL-3 ReviewOrchestrator — `confirm(reviewId, body, actor)` (BR-RW5)

```text
1. review = Review.findOne({ id: reviewId, projectId })
2. assertConfirmer:
   - actor.globalRole === ADMIN → pass
   - or membership.projectRole === REVIEWER → pass
   - else 403
3. ReviewStatusTransition.assertTransition(review.status, CONFIRMED)
4. transaction:
   a. report = ReviewReportService.generateMarkdown({ project, scorecard, notes, ratingSystem })
   b. awardedTotal = Σ entry.awardedPoints across attempted credits
   c. certificationLevel = deriveCertificationLevel(awardedTotal, ratingSystem.certificationLevels)
   d. outcome =
       body.outcome
       ?? (every-attempted-fully-awarded && certificationLevel ? PASSED
         : certificationLevel ? PASSED_WITH_ISSUES
         : DENIED)
   e. review.status = CONFIRMED
      review.outcome = outcome
      review.confirmedByUserId = actor.id; review.confirmedAt = NOW()
      review.reportMarkdown = report
      review.reportGeneratedAt = NOW()
      review.awardedTotal = awardedTotal
      review.certificationLevel = certificationLevel
      review.version++; AuditStampHelper.stampUpdate(review, actor.id); save.
   f. AuditService.record('Review.confirmed', { outcome, awardedTotal, certificationLevel })
```

---

## BL-4 ReviewOrchestrator — `return(reviewId, actor)` (BR-RW6)

```text
1. review = Review.findOne({ id: reviewId, projectId })
2. assertReturner (Reviewer who confirmed OR Admin)
3. ReviewStatusTransition.assertTransition(CONFIRMED, RETURNED)
4. transaction:
   a. review.status = RETURNED
      review.returnedByUserId = actor.id; review.returnedAt = NOW()
      review.version++; save.
   b. ProjectsService.transitionStatus(project, REGISTERED, actor.id)
        // the U3 state machine extension permits UNDER_REVIEW → REGISTERED in U5 (BR-Z2).
   c. AuditService.record('Review.returned', { reviewId, outcome: review.outcome })
5. Post-commit: NotificationGateway.send({ kind: 'review-returned', context: {...} })
```

---

## BL-5 AcceptCertificationFlow (BR-AC1, US-7.6)

```text
1. assertWriter (Project Team / Green Rater / Admin)
2. assertWritable(projectId, actor)              // Admin bypasses; project must be REGISTERED
3. latestReturnedReview = Review.find({ projectId, status: RETURNED })
                                .sortBy('submittedAt DESC').first
4. if !latestReturnedReview → 409 ("no returned review yet")
5. if latestReturnedReview.outcome === DENIED → 409 ("review denied; cannot accept")
6. transaction:
   a. ProjectsService.transitionStatus(project, CERTIFIED, actor.id)
   b. project.achievedCertificationLevel = latestReturnedReview.certificationLevel
      project.version++; save.
   c. AuditService.record('Project.certified', {
        reviewId, certificationLevel, awardedTotal })
7. Return { project, review: latestReturnedReview }
```

---

## BL-6 ContinueToNextPhase (BR-AC2)

```text
1. assertWriter (Project Team / Green Rater / Admin)
2. latestReturned = (same lookup as BL-5)
3. if !latestReturned → 409 ("no returned review")
4. AuditService.record('Project.continueToNextPhase', { fromPhase: latestReturned.phase })
   // No status change — the project is already REGISTERED after return; this endpoint records
   // the team's intent for dashboards. Submitting the next phase is the actionable next step.
```

---

## BL-7 SubmittalQualityScoreFlow (BR-QS1..BR-QS3)

```text
1. assertWriter (Reviewer membership or Admin)
2. assertWritable(projectId, actor)
3. review = Review.findOne({ id: reviewId, projectId })
4. existing = SubmittalQualityScore.findOne({ projectId, reviewId })
5. if existing:
     before = { score: existing.score, notes: existing.notes }
     existing.score = body.score; existing.notes = body.notes ?? null
     existing.enteredByUserId = actor.id; existing.enteredAt = NOW()
     existing.version++; AuditStampHelper.stampUpdate(...); save.
   else:
     create + AuditStampHelper.stampInsert(...) save.
6. AuditService.record('SubmittalQualityScore.upserted', { before, after })
```

---

## BL-8 Reviewer assignment shortcut (BR-AS1)

```text
1. assertAdmin
2. user = UsersService.findById(body.userId); 404 if missing
3. MembershipService.addMember(user.id, projectId, REVIEWER, invitedBy=actor.id, actorUserId=actor.id)
   // idempotent — returns existing row if already a Reviewer on this project.
```

---

## BL-9 ReviewReportService.generateMarkdown — pure (BR-RP1..BR-RP3)

```ts
function generateMarkdown(input: {
  project: { displayName: string; gbciDisplayId: string; ratingSystemSlug: string };
  phase: ReviewPhase;
  ratingSystem: { name: string; totalPointsAvailable: number; certificationLevels: ... };
  categories: Array<{
    slug: string; name: string;
    credits: Array<{
      slug: string; name: string; kind: 'credit'|'prerequisite';
      attemptedPoints: number; verifiedPoints: number; awardedPoints: number;
      reviewerNote: string | null;
    }>;
  }>;
  awardedTotal: number;
  certificationLevel: string | null;
  outcome: ReviewOutcome | null;
  reviewedByName: string | null;
  confirmedByName: string | null;
  generatedAt: Date;
}): string;
```

The function emits a deterministic Markdown string. Lives at
`src/review/report/review-report.generator.ts` — pure, no Nest imports. Same-input/same-output
makes it test-friendly (PBT candidate; not test-generated this build).

---

## BL-10 State-lock — real implementation (BR-Z1, US-11.2)

```ts
@Injectable()
export class StateLockService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
  ) {}

  async assertWritable(
    projectId: string,
    actor?: { userId: string; globalRole: GlobalRole },
  ): Promise<void> {
    if (!actor) return; // system writes pass.
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const project = await this.repo.findOne({ where: { id: projectId } });
    if (!project) return; // create paths pre-existence; let the caller 404.
    if (project.status === ProjectStatus.UNDER_REVIEW) {
      throw new ConflictException(
        'Project is under review and cannot be edited until the review is returned.',
      );
    }
  }
}
```

The U2/U4 call sites are extended to pass `actor` (an Actor with `userId` + `globalRole`).
Where the actor is unknown (system seeders, demo bridges), the call passes `undefined` and
the lock no-ops — preserves the original system-write contract.

---

## BL-11 Reviewer notes integration (BR-RD3)

The U4 `WorkbookService.saveNote(...)` already supports `column: REVIEWER` writes by Reviewer
+ Admin (BR-WN2). U5 doesn't add a parallel "review-comment" entity; the FE reviewer page
simply renders + saves through the existing notes endpoint, just scoped to the REVIEWER column.

The auto-generated review report (BL-9) reads these notes when emitting the per-credit comment
column.

---

## Testable Properties (PBT-01)

Three properties identified for U5. Tests deferred per documented U1 PBT deviation; pure
subjects implemented test-friendly.

### FL-9 Award range invariant
- For all `(creditId, awardedPoints)`: a successful `setAwarded` write satisfies
  `0 ≤ awardedPoints ≤ verifiedPoints`. Any out-of-range input throws.

### FL-10 State-machine invariant
- For all sequences of `(submitOp, awardOp, confirmOp, returnOp, acceptOp)` operations applied
  to a (projectStatus, reviewStatus) pair: the `assertTransition` functions reject every
  illegal transition AND the resulting state never enters a not-listed combination. The two
  pure machines compose: project status transitions imply review status pre-conditions, and
  vice versa.

### FL-11 Award-all-verified idempotence
- For any project P with attempted credits in any `awardedPoints` configuration: applying
  `awardAllVerified(P, review)` twice yields the same final scorecard as applying it once.
- Per-entry `version` increments at most once across the two calls (the second call no-ops on
  already-equal entries).

---

## Cross-cutting touchpoints

| Concern | Where |
|---|---|
| Audit timestamps | Inherited from U1 (`AuditStampInterceptor` + `AuditStampHelper`) |
| Audit log rows | `AuditService.record` on every transition |
| Throttling | Inherited; no new per-route limits this unit |
| Auth & RBAC | `JwtAuthGuard` global + `ProjectRolesGuard` on `/projects/:id/*` |
| Notifications | `NotificationGateway.send({ kind: 'submission-confirmed' \| 'review-returned' })` — best-effort post-commit |
| FE state | Signal-based `ReviewStore` per project; no sessionStorage drafts (review actions are immediate) |
| State-lock | `StateLockService.assertWritable(projectId, actor?)` — real implementation lands here |
