import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScorecardEntry } from '../scorecard/scorecard-entry.entity';
import { VerificationNote } from '../workbook/entities/verification-note.entity';
import { NoteColumn } from '../workbook/enums';
import { CatalogService } from '../catalog/catalog.service';
import { UsersService } from '../users/users.service';
import { Project } from '../projects/project.entity';
import { Review } from './review.entity';
import { deriveCertificationLevel } from '../scorecard/calculator/scorecard-summary.calculator';
import { generateMarkdown, ReportCategory } from './report/review-report.generator';

export interface ReviewComputation {
  markdown: string;
  awardedTotal: number;
  certificationLevel: string | null;
  everyAttemptedFullyAwarded: boolean;
}

/** Builds the report input from the DB and runs the pure generator (BR-RP). */
@Injectable()
export class ReviewReportService {
  constructor(
    @InjectRepository(ScorecardEntry) private readonly entries: Repository<ScorecardEntry>,
    @InjectRepository(VerificationNote) private readonly notes: Repository<VerificationNote>,
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
  ) {}

  async compute(project: Project, review: Review): Promise<ReviewComputation> {
    const ratingSystem = await this.catalog.getRatingSystem(project.ratingSystemId);
    const attempted = await this.entries.find({
      where: { projectId: project.id, attempted: true },
    });
    const entryByCredit = new Map(attempted.map((e) => [e.creditId, e]));
    const reviewerNotes = await this.notes.find({
      where: { projectId: project.id, column: NoteColumn.REVIEWER },
    });
    const noteByCredit = new Map(reviewerNotes.map((n) => [n.creditId, n.body]));

    const categories: ReportCategory[] = ratingSystem.categories
      .map((cat) => ({
        slug: cat.slug,
        name: cat.name,
        credits: cat.credits
          .filter((c) => entryByCredit.has(c.id))
          .map((c) => {
            const e = entryByCredit.get(c.id)!;
            return {
              slug: c.slug,
              name: c.name,
              kind: c.kind,
              attemptedPoints: e.attemptedPoints,
              verifiedPoints: e.verifiedPoints,
              awardedPoints: e.awardedPoints,
              reviewerNote: noteByCredit.get(c.id) ?? null,
            };
          }),
      }))
      .filter((cat) => cat.credits.length > 0);

    const awardedTotal = attempted.reduce((acc, e) => acc + e.awardedPoints, 0);
    const certificationLevel = deriveCertificationLevel(
      awardedTotal,
      ratingSystem.certificationLevels,
    );
    const everyAttemptedFullyAwarded = attempted.every((e) => e.awardedPoints === e.verifiedPoints);

    const reviewedByName = await this.nameOf(review.reviewedByUserId);
    const confirmedByName = await this.nameOf(review.confirmedByUserId);
    const returnedByName = await this.nameOf(review.returnedByUserId);

    const markdown = generateMarkdown({
      project: {
        displayName: project.name,
        gbciDisplayId: project.gbciDisplayId ?? '(unassigned)',
        ratingSystemSlug: ratingSystem.slug,
      },
      phase: review.phase,
      ratingSystem: {
        name: ratingSystem.name,
        totalPointsAvailable: ratingSystem.totalPointsAvailable,
      },
      categories,
      awardedTotal,
      certificationLevel,
      outcome: review.outcome,
      reviewedByName,
      confirmedByName,
      returnedByName,
      generatedAt: new Date(),
    });

    return { markdown, awardedTotal, certificationLevel, everyAttemptedFullyAwarded };
  }

  private async nameOf(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.users.findById(userId);
    return user?.name ?? user?.email ?? null;
  }
}
