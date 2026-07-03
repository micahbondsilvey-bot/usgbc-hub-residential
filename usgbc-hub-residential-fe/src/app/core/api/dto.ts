/** Shared API DTO types (mirror of backend contracts; generated from OpenAPI later). */

export type GlobalRole = 'admin' | 'user';
export type ProjectRole = 'PROJECT_TEAM' | 'GREEN_RATER' | 'REVIEWER';
export type InvitationState = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  greenRaterCredentialId: string | null;
  globalRole: GlobalRole;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
}

export interface UpdateProfileRequest {
  name?: string;
  organization?: string;
  greenRaterCredentialId?: string;
}

export interface InvitationPreview {
  projectId: string;
  inviteeEmail: string;
  projectRole: ProjectRole;
  state: InvitationState;
  expiresAt: string;
  accountExists: boolean;
}

export interface AcceptInvitationRequest {
  token: string;
  newPassword?: string;
  name?: string;
}

export interface AcceptInvitationResponse {
  projectId: string;
  projectRole: ProjectRole;
}

export interface MeRoleResponse {
  projectRole: ProjectRole | null;
}

// ── Unit 2: Catalog & Scorecard ─────────────────────────────────────

export type CreditKind = 'prerequisite' | 'credit';

export interface CertificationLevel {
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

export interface CreditPointValueDto {
  id: string;
  tierLabel: string;
  points: number;
  displayOrder: number;
}

export interface CreditDto {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  kind: CreditKind;
  pointsMin: number | null;
  pointsMax: number | null;
  intent: string | null;
  requirementsSummary: string | null;
  referenceGuideUrl: string | null;
  tags: string[];
  displayOrder: number;
  pointValues: CreditPointValueDto[];
}

export interface CreditCategoryDto {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
  iconRef: string | null;
  credits: CreditDto[];
}

export interface RatingSystemDto {
  id: string;
  slug: string;
  name: string;
  version: string;
  program: string;
  totalPointsAvailable: number;
  certificationLevels: CertificationLevel[];
  categories: CreditCategoryDto[];
}

export interface ScorecardEntryDto {
  id: string;
  projectId: string;
  creditId: string;
  attempted: boolean;
  attemptedPoints: number;
  verifiedPoints: number;
  awardedPoints: number;
  selectedPointValueId: string | null;
  version: number;
  notes: string | null;
}

export type WarningColumn = 'attempted' | 'verified' | 'awarded';

export interface ScorecardWarning {
  creditId: string;
  column: WarningColumn;
  value: number;
  allowedMin: number;
  allowedMax: number;
  reason: 'value_out_of_credit_range';
}

export interface CategorySummary {
  categoryId: string;
  categorySlug: string;
  name: string;
  attempted: number;
  verified: number;
  awarded: number;
  attemptedPointsAvailable: number;
  awardedPointsAvailable: number;
}

export interface ScorecardSummary {
  perCategory: CategorySummary[];
  overall: { attempted: number; verified: number; awarded: number; totalAvailable: number };
  certificationLevel: string | null;
}

export interface ScorecardDto {
  entries: ScorecardEntryDto[];
  summary: ScorecardSummary;
  warnings: ScorecardWarning[];
}

export interface UpdateScorecardEntryRequest {
  attempted?: boolean;
  attemptedPoints?: number;
  verifiedPoints?: number;
  awardedPoints?: number;
  selectedPointValueId?: string;
}

// ── Unit 3: Registration & Fees ─────────────────────────────────────

export type ProjectStatus =
  | 'DRAFT'
  | 'REGISTERED'
  | 'UNDER_REVIEW'
  | 'CERTIFIED'
  | 'DENIED'
  | 'WITHDRAWN';
export type BuildingType =
  | 'SINGLE_FAMILY_DETACHED'
  | 'SINGLE_FAMILY_ATTACHED'
  | 'TOWNHOUSE';
export type PaymentChoice = 'PAY_NOW' | 'PAY_LATER';
export type InvoiceStatus = 'PAID' | 'UNPAID';
export type BulkRowStatus = 'PENDING' | 'CREATED' | 'FAILED';

export interface ProjectDto {
  id: string;
  gbciDisplayId: string | null;
  sapProjectId: string | null;
  ratingSystemId: string;
  status: ProjectStatus;
  name: string;
  membershipLevel: MembershipLevel;
  buildingType: BuildingType;
  numberOfUnits: number;
  grossArea: number | null;
  targetCertificationLevel: string | null;
  parentAnchorId: string | null;
  isPortfolioAnchor: boolean;
  achievedCertificationLevel: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerOrganization: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  latitude: string | null;
  longitude: string | null;
  registeredAt: string | null;
  registeredByUserId: string | null;
  version: number;
}

export interface FeeQuoteLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface FeeQuoteDto {
  amountCents: number;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: FeeQuoteLineItem[];
  scheduleId: string | null;
  warnings: { reason: string }[];
}

export interface InvoiceDto {
  id: string;
  projectId: string;
  displayId: string;
  paymentChoice: PaymentChoice;
  status: InvoiceStatus;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: FeeQuoteLineItem[];
  paymentProviderRef: string | null;
  paidAt: string | null;
  generatedAt: string;
  version: number;
}

export interface CertificationAgreementDto {
  id: string;
  projectId: string;
  signedByUserId: string;
  signedByName: string;
  signedAt: string;
  agreementVersion: string;
  agreementTextHash: string;
}

/** Flat create/register request matching the backend CreateProjectDto. */
export interface CreateProjectRequest {
  mode: 'draft' | 'register';
  draftProjectId?: string;
  ratingSystemId?: string;
  ratingSystemSlug?: string;
  name?: string;
  membershipLevel?: MembershipLevel;
  buildingType?: BuildingType;
  numberOfUnits?: number;
  grossArea?: number;
  targetCertificationLevel?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerOrganization?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  paymentChoice?: PaymentChoice;
  acceptedAgreementVersion?: string;
}

export interface RegisterResponse {
  project: ProjectDto;
  invoice: InvoiceDto;
}

export interface BulkRowOutcome {
  externalRowId: string;
  status: BulkRowStatus;
  projectId: string | null;
  errorMessage: string | null;
}

export interface BulkUploadResponse {
  batchId: string;
  totalRows: number;
  succeeded: number;
  failed: number;
  perRowOutcomes: BulkRowOutcome[];
}

// ── Unit 4: Workbook ────────────────────────────────────────────────

export type NoteColumn = 'GREEN_RATER' | 'PROVIDER_QC' | 'REVIEWER';

export interface WorkbookFieldEntryDto {
  id: string;
  creditId: string;
  fieldDefinitionId: string;
  fieldKey: string;
  label: string;
  dataType: string;
  unit: string | null;
  areaTag: string | null;
  helpText: string | null;
  enumOptions: string[] | null;
  derived: boolean;
  required: boolean;
  value: string | number | boolean | null;
  displayOrder: number;
  version: number;
}

export interface WorkbookSubmittalDto {
  id: string;
  slotId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedAt: string;
}

export interface WorkbookSubmittalSlotDto {
  id: string;
  creditId: string;
  slotDefinitionId: string;
  slotKey: string;
  label: string;
  requirementNote: string | null;
  required: boolean;
  multiUpload: boolean;
  files: WorkbookSubmittalDto[];
}

export interface WorkbookVerificationNoteDto {
  creditId: string;
  column: NoteColumn;
  body: string | null;
  savedByUserId: string | null;
  savedAt: string | null;
  version: number;
}

export interface CreditWorkbookDto {
  creditId: string;
  fieldEntries: WorkbookFieldEntryDto[];
  slots: WorkbookSubmittalSlotDto[];
  notes: WorkbookVerificationNoteDto[];
  hasFieldEntries: boolean;
  hasSubmittals: boolean;
  hasNotes: boolean;
}

export interface WorkbookDto {
  credits: CreditWorkbookDto[];
}

export interface WriteFieldEntryRequest {
  value: string | number | boolean | null;
}

export interface WriteNoteRequest {
  body: string | null;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
}

// ── Unit 5: Review Workflow ─────────────────────────────────────────

export type ReviewPhase = 'PRELIMINARY' | 'FINAL' | 'SUPPLEMENTAL';
export type ReviewStatus = 'OPEN' | 'SUBMITTED' | 'DECIDED' | 'CONFIRMED' | 'RETURNED';
export type ReviewOutcome = 'PASSED' | 'PASSED_WITH_ISSUES' | 'DENIED';

export interface ReviewDto {
  id: string;
  displayId: string;
  projectId: string;
  phase: ReviewPhase;
  status: ReviewStatus;
  outcome: ReviewOutcome | null;
  submittedByUserId: string;
  submittedAt: string;
  reviewedByUserId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  returnedByUserId: string | null;
  returnedAt: string | null;
  reportMarkdown: string | null;
  reportGeneratedAt: string | null;
  awardedTotal: number | null;
  certificationLevel: string | null;
  version: number;
}

export interface SubmittalQualityScoreDto {
  id: string;
  projectId: string;
  reviewId: string;
  score: number;
  notes: string | null;
  enteredByUserId: string;
  enteredAt: string;
  version: number;
}

export interface ConfirmReviewRequest {
  outcome?: ReviewOutcome;
  reportNotes?: string;
}

// ── Unit 6: Portfolio ───────────────────────────────────────────────

export interface PortfolioProjectSummaryDto {
  id: string;
  gbciDisplayId: string | null;
  name: string;
  status: ProjectStatus;
  achievedCertificationLevel: string | null;
  targetCertificationLevel: string | null;
  isPortfolioAnchor: boolean;
  parentAnchorId: string | null;
  attemptedTotal: number;
  awardedTotal: number;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
    outcome: ReviewOutcome | null;
    submittedAt: string;
    returnedAt: string | null;
  } | null;
}

export interface PortfolioDashboardDto {
  anchor: PortfolioProjectSummaryDto;
  children: PortfolioProjectSummaryDto[];
  rollup: {
    totalChildren: number;
    byStatus: Record<string, number>;
    byCertificationLevel: Record<string, number>;
    attemptedTotal: number;
    awardedTotal: number;
  };
}

export interface PortfolioFeeQuoteDto {
  anchorProjectId: string;
  phase: ReviewPhase;
  lineItems: Array<{
    projectId: string;
    displayProjectId: string | null;
    registrationFeeCents: number;
    reviewFeeCents: number;
    totalCents: number;
    warnings: { reason: string }[];
  }>;
  totals: {
    registrationFeeCents: number;
    reviewFeeCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  };
  warnings: { reason: string }[];
}

export type ChildSubmitStatus = 'SUBMITTED' | 'SKIPPED_INELIGIBLE' | 'FAILED';

export interface BatchSubmitResult {
  anchor: {
    projectId: string;
    displayProjectId: string | null;
    status: 'SUBMITTED' | 'ANCHOR_INELIGIBLE' | 'ANCHOR_FAILED';
    reviewDisplayId?: string;
    reason?: string;
    error?: { code: string; message: string };
  };
  children: Array<{
    projectId: string;
    displayProjectId: string | null;
    status: ChildSubmitStatus;
    reviewDisplayId?: string;
    reason?: string;
    error?: { code: string; message: string };
  }>;
  summary: { submittedCount: number; skippedCount: number; failedCount: number };
}

// ── Unit 7: Dashboards & Notifications ──────────────────────────────

export type NotificationKind =
  | 'INVITATION_SENT'
  | 'REGISTRATION_CONFIRMED'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_RETURNED'
  | 'PORTFOLIO_BATCH_COMPLETED'
  | 'REVIEWER_ASSIGNED';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  subject: string;
  bodyMarkdown: string;
  context: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  firedAt: string;
  version: number;
}

export interface NotificationPageDto {
  rows: NotificationDto[];
  nextCursor: string | null;
}

export interface DashboardItemDto {
  project: ProjectDto;
  attemptedTotal: number;
  awardedTotal: number;
  outstandingActions: Array<Record<string, unknown>>;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
  } | null;
  workbookProgress?: {
    creditsAttempted: number;
    creditsWithSubmittal: number;
    creditsWithGreenRaterNote: number;
    totalAttempted: number;
  };
  latestQualityScore?: { reviewId: string; score: number; enteredAt: string } | null;
}

export interface DashboardDto {
  items: DashboardItemDto[];
}

export interface ReviewerDashboardDto {
  buckets: Record<string, Array<{
    review: ReviewDto;
    project: { id: string; gbciDisplayId: string | null; name: string; status: ProjectStatus };
    scorecardRollup: { attemptedTotal: number; verifiedTotal: number; awardedTotal: number };
    latestQualityScore: { score: number; enteredAt: string } | null;
  }>>;
}

export interface PipelineRowDto {
  id: string;
  gbciDisplayId: string | null;
  name: string;
  status: ProjectStatus;
  isPortfolioAnchor: boolean;
  attemptedTotal: number;
  awardedTotal: number;
  achievedCertificationLevel: string | null;
  latestReview: {
    reviewId: string;
    reviewDisplayId: string;
    phase: ReviewPhase;
    status: ReviewStatus;
    outcome: ReviewOutcome | null;
  } | null;
  latestQualityScore: { reviewId: string; score: number; enteredAt: string } | null;
  assignedReviewer: { userId: string; name: string | null; email: string } | null;
}

export interface AdminPipelinePageDto {
  rows: PipelineRowDto[];
  nextCursor: string | null;
  filter: Record<string, string | undefined>;
}
