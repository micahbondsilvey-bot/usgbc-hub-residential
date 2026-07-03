import { ReviewOutcome, ReviewPhase } from '../enums';

/** Pure Markdown review-report generator (BR-RP1..BR-RP3, BL-9). No Nest imports. */

export interface ReportCredit {
  slug: string;
  name: string;
  kind: 'credit' | 'prerequisite';
  attemptedPoints: number;
  verifiedPoints: number;
  awardedPoints: number;
  reviewerNote: string | null;
}

export interface ReportCategory {
  slug: string;
  name: string;
  credits: ReportCredit[];
}

export interface ReportInput {
  project: { displayName: string; gbciDisplayId: string; ratingSystemSlug: string };
  phase: ReviewPhase;
  ratingSystem: { name: string; totalPointsAvailable: number };
  categories: ReportCategory[];
  awardedTotal: number;
  certificationLevel: string | null;
  outcome: ReviewOutcome | null;
  reviewedByName: string | null;
  confirmedByName: string | null;
  returnedByName: string | null;
  generatedAt: Date;
}

function esc(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function sumBy(credits: ReportCredit[], key: 'attemptedPoints' | 'verifiedPoints' | 'awardedPoints'): number {
  return credits.reduce((acc, c) => acc + c[key], 0);
}

export function generateMarkdown(input: ReportInput): string {
  const lines: string[] = [];
  const allCredits = input.categories.flatMap((c) => c.credits);
  const attempted = sumBy(allCredits, 'attemptedPoints');
  const verified = sumBy(allCredits, 'verifiedPoints');

  lines.push(`# Review Report — ${esc(input.project.displayName)}`);
  lines.push('');
  lines.push(`- **GBCI ID:** ${input.project.gbciDisplayId}`);
  lines.push(`- **Rating system:** ${esc(input.ratingSystem.name)}`);
  lines.push(`- **Phase:** ${input.phase}`);
  lines.push(`- **Generated:** ${input.generatedAt.toISOString()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Points |');
  lines.push('| --- | ---: |');
  lines.push(`| Attempted | ${attempted} |`);
  lines.push(`| Verified | ${verified} |`);
  lines.push(`| Awarded | ${input.awardedTotal} |`);
  lines.push(`| Available | ${input.ratingSystem.totalPointsAvailable} |`);
  lines.push(`| Certification level | ${input.certificationLevel ?? 'None achieved'} |`);
  lines.push('');

  for (const category of input.categories) {
    lines.push(`## ${esc(category.name)}`);
    lines.push('');
    lines.push(`- Awarded: ${sumBy(category.credits, 'awardedPoints')} / Verified: ${sumBy(category.credits, 'verifiedPoints')} / Attempted: ${sumBy(category.credits, 'attemptedPoints')}`);
    lines.push('');
    lines.push('| Credit | Kind | Attempted | Verified | Awarded | Reviewer comment |');
    lines.push('| --- | --- | ---: | ---: | ---: | --- |');
    for (const credit of category.credits) {
      lines.push(
        `| ${esc(credit.name)} | ${credit.kind} | ${credit.attemptedPoints} | ${credit.verifiedPoints} | ${credit.awardedPoints} | ${esc(credit.reviewerNote ?? '')} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Outcome');
  lines.push('');
  lines.push(`- **Outcome:** ${input.outcome ?? 'Pending'}`);
  if (input.reviewedByName) lines.push(`- **Reviewed by:** ${esc(input.reviewedByName)}`);
  if (input.confirmedByName) lines.push(`- **Confirmed by:** ${esc(input.confirmedByName)}`);
  if (input.returnedByName) lines.push(`- **Returned by:** ${esc(input.returnedByName)}`);
  lines.push('');

  return lines.join('\n');
}
