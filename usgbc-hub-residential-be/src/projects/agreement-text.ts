import { createHash } from 'node:crypto';

/** Current certification agreement text (BR-A2). Editing this changes the hash. */
export const AGREEMENT_TEXT_V1 = `USGBC / GBCI LEED v4.1 Residential Single Family Certification Agreement (v1.0)

By accepting this agreement, the signing party affirms that the information provided for
certification is accurate to the best of their knowledge, agrees to the GBCI certification
policies and program requirements, and authorizes GBCI to review submitted documentation for
the purpose of certification. Fees are non-refundable once a project is registered. This is a
demonstration agreement for the USGBC Hub Residential platform.`;

export const AGREEMENT_VERSION_V1 = 'v1.0';

export function hashAgreementText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
