import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  BulkUploadResponse,
  CertificationAgreementDto,
  ConfirmReviewRequest,
  CreateProjectRequest,
  FeeQuoteDto,
  InvitationPreview,
  InvoiceDto,
  LoginRequest,
  LoginResponse,
  MeRoleResponse,
  MembershipLevel,
  Profile,
  ProjectDto,
  RatingSystemDto,
  RegisterResponse,
  ReviewDto,
  ReviewPhase,
  BatchSubmitResult,
  PortfolioDashboardDto,
  PortfolioFeeQuoteDto,
  NotificationPageDto,
  NotificationDto,
  DashboardDto,
  ReviewerDashboardDto,
  AdminPipelinePageDto,
  ScorecardDto,
  ScorecardEntryDto,
  ScorecardSummary,
  SignedUrlResponse,
  SubmittalQualityScoreDto,
  UpdateProfileRequest,
  UpdateScorecardEntryRequest,
  WorkbookDto,
  WorkbookFieldEntryDto,
  WorkbookSubmittalDto,
  WorkbookVerificationNoteDto,
  WriteFieldEntryRequest,
  WriteNoteRequest,
} from './dto';

/** Typed wrapper around HttpClient for the Unit 1 API surface. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, body);
  }

  me(): Observable<Profile> {
    return this.http.get<Profile>(`${this.base}/auth/me`);
  }

  getProfile(): Observable<Profile> {
    return this.http.get<Profile>(`${this.base}/users/me`);
  }

  updateProfile(body: UpdateProfileRequest): Observable<Profile> {
    return this.http.put<Profile>(`${this.base}/users/me`, body);
  }

  requestPasswordReset(email: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/auth/password/reset/request`, {
      email,
    });
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/auth/password/reset/confirm`, {
      token,
      newPassword,
    });
  }

  verifyEmail(token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/auth/email/verify`, { token });
  }

  previewInvitation(token: string): Observable<InvitationPreview> {
    return this.http.get<InvitationPreview>(`${this.base}/invitations/preview`, {
      params: { token },
    });
  }

  acceptInvitation(body: AcceptInvitationRequest): Observable<AcceptInvitationResponse> {
    return this.http.post<AcceptInvitationResponse>(`${this.base}/invitations/accept`, body);
  }

  declineInvitation(token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/invitations/decline`, { token });
  }

  meRole(projectId: string): Observable<MeRoleResponse> {
    return this.http.get<MeRoleResponse>(`${this.base}/projects/${projectId}/me-role`);
  }

  // ── Unit 2: Catalog & Scorecard ───────────────────────────────────

  getRatingSystem(idOrSlug: string): Observable<RatingSystemDto> {
    return this.http.get<RatingSystemDto>(`${this.base}/catalog/rating-systems/${idOrSlug}`);
  }

  getScorecard(projectId: string): Observable<ScorecardDto> {
    return this.http.get<ScorecardDto>(`${this.base}/projects/${projectId}/scorecard`);
  }

  getScorecardSummary(projectId: string): Observable<ScorecardSummary> {
    return this.http.get<ScorecardSummary>(`${this.base}/projects/${projectId}/scorecard/summary`);
  }

  updateScorecardEntry(
    projectId: string,
    creditId: string,
    body: UpdateScorecardEntryRequest,
  ): Observable<{ entry: ScorecardEntryDto; warnings: unknown[] }> {
    return this.http.put<{ entry: ScorecardEntryDto; warnings: unknown[] }>(
      `${this.base}/projects/${projectId}/scorecard/${creditId}`,
      body,
    );
  }

  unAttemptCredit(projectId: string, creditId: string): Observable<ScorecardEntryDto> {
    return this.http.post<ScorecardEntryDto>(
      `${this.base}/projects/${projectId}/scorecard/${creditId}/un-attempt`,
      {},
    );
  }

  // ── Unit 3: Registration & Fees ───────────────────────────────────

  listProjects(mineOnly = true): Observable<ProjectDto[]> {
    return this.http.get<ProjectDto[]>(`${this.base}/projects`, {
      params: { mine: String(mineOnly) },
    });
  }

  getProject(id: string): Observable<ProjectDto> {
    return this.http.get<ProjectDto>(`${this.base}/projects/${id}`);
  }

  createProject(body: CreateProjectRequest): Observable<ProjectDto | RegisterResponse> {
    return this.http.post<ProjectDto | RegisterResponse>(`${this.base}/projects`, body);
  }

  patchProject(id: string, patch: Partial<ProjectDto>): Observable<ProjectDto> {
    return this.http.patch<ProjectDto>(`${this.base}/projects/${id}`, patch);
  }

  withdrawProject(id: string, note: string): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(`${this.base}/projects/${id}/withdraw`, { note });
  }

  getInvoice(projectId: string): Observable<InvoiceDto> {
    return this.http.get<InvoiceDto>(`${this.base}/projects/${projectId}/invoice`);
  }

  getAgreement(projectId: string): Observable<CertificationAgreementDto> {
    return this.http.get<CertificationAgreementDto>(`${this.base}/projects/${projectId}/agreement`);
  }

  getFeeQuote(ratingSystemSlug: string, membershipLevel: MembershipLevel): Observable<FeeQuoteDto> {
    return this.http.get<FeeQuoteDto>(`${this.base}/registration/fee-quote`, {
      params: { ratingSystemSlug, membershipLevel },
    });
  }

  uploadBulkRegistration(file: File): Observable<BulkUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<BulkUploadResponse>(`${this.base}/projects/bulk`, form);
  }

  // ── Unit 4: Workbook ──────────────────────────────────────────────

  getWorkbook(projectId: string): Observable<WorkbookDto> {
    return this.http.get<WorkbookDto>(`${this.base}/projects/${projectId}/workbook`);
  }

  getWorkbookFlags(
    projectId: string,
  ): Observable<Record<string, { hasFieldEntries: boolean; hasSubmittals: boolean; hasNotes: boolean }>> {
    return this.http.get<
      Record<string, { hasFieldEntries: boolean; hasSubmittals: boolean; hasNotes: boolean }>
    >(`${this.base}/projects/${projectId}/workbook/flags`);
  }

  writeFieldEntry(
    projectId: string,
    creditId: string,
    fieldDefinitionId: string,
    body: WriteFieldEntryRequest,
  ): Observable<{ entry: WorkbookFieldEntryDto; warnings: unknown[] }> {
    return this.http.put<{ entry: WorkbookFieldEntryDto; warnings: unknown[] }>(
      `${this.base}/projects/${projectId}/workbook/credits/${creditId}/fields/${fieldDefinitionId}`,
      body,
    );
  }

  writeNote(
    projectId: string,
    creditId: string,
    column: string,
    body: WriteNoteRequest,
  ): Observable<WorkbookVerificationNoteDto> {
    return this.http.put<WorkbookVerificationNoteDto>(
      `${this.base}/projects/${projectId}/workbook/credits/${creditId}/notes/${column}`,
      body,
    );
  }

  uploadSubmittal(
    projectId: string,
    creditId: string,
    slotKey: string,
    file: File,
  ): Observable<WorkbookSubmittalDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<WorkbookSubmittalDto>(
      `${this.base}/projects/${projectId}/workbook/credits/${creditId}/slots/${slotKey}/files`,
      form,
    );
  }

  deleteSubmittal(projectId: string, submittalId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/projects/${projectId}/workbook/files/${submittalId}`,
    );
  }

  getSubmittalUrl(projectId: string, submittalId: string): Observable<SignedUrlResponse> {
    return this.http.get<SignedUrlResponse>(
      `${this.base}/projects/${projectId}/workbook/files/${submittalId}/url`,
    );
  }

  // ── Unit 5: Review Workflow ───────────────────────────────────────

  listReviews(projectId: string): Observable<ReviewDto[]> {
    return this.http.get<ReviewDto[]>(`${this.base}/projects/${projectId}/reviews`);
  }

  getReview(projectId: string, reviewId: string): Observable<ReviewDto> {
    return this.http.get<ReviewDto>(`${this.base}/projects/${projectId}/reviews/${reviewId}`);
  }

  submitReview(projectId: string, phase: ReviewPhase): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(`${this.base}/projects/${projectId}/reviews`, { phase });
  }

  awardCredit(
    projectId: string,
    reviewId: string,
    creditId: string,
    awardedPoints: number,
  ): Observable<unknown> {
    return this.http.put(
      `${this.base}/projects/${projectId}/reviews/${reviewId}/credits/${creditId}/award`,
      { awardedPoints },
    );
  }

  awardAllVerified(
    projectId: string,
    reviewId: string,
  ): Observable<{ updatedCount: number }> {
    return this.http.post<{ updatedCount: number }>(
      `${this.base}/projects/${projectId}/reviews/${reviewId}/award-all-verified`,
      {},
    );
  }

  confirmReview(
    projectId: string,
    reviewId: string,
    body: ConfirmReviewRequest,
  ): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(
      `${this.base}/projects/${projectId}/reviews/${reviewId}/confirm`,
      body,
    );
  }

  returnReview(projectId: string, reviewId: string): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(
      `${this.base}/projects/${projectId}/reviews/${reviewId}/return`,
      {},
    );
  }

  upsertQualityScore(
    projectId: string,
    reviewId: string,
    score: number,
    notes: string | null,
  ): Observable<SubmittalQualityScoreDto> {
    return this.http.put<SubmittalQualityScoreDto>(
      `${this.base}/projects/${projectId}/reviews/${reviewId}/quality-score`,
      { score, notes },
    );
  }

  listQualityScores(projectId: string): Observable<SubmittalQualityScoreDto[]> {
    return this.http.get<SubmittalQualityScoreDto[]>(
      `${this.base}/projects/${projectId}/quality-scores`,
    );
  }

  acceptCertification(projectId: string): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(`${this.base}/projects/${projectId}/accept`, {});
  }

  continueToNextPhase(projectId: string): Observable<{ fromPhase: ReviewPhase }> {
    return this.http.post<{ fromPhase: ReviewPhase }>(
      `${this.base}/projects/${projectId}/continue-to-next-phase`,
      {},
    );
  }

  assignReviewer(projectId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/projects/${projectId}/reviewers`, { userId });
  }

  // ── Unit 6: Portfolio ─────────────────────────────────────────────

  toggleAnchor(projectId: string, isPortfolioAnchor: boolean): Observable<ProjectDto> {
    return this.http.patch<ProjectDto>(`${this.base}/projects/${projectId}/anchor`, {
      isPortfolioAnchor,
    });
  }

  setParentAnchor(projectId: string, parentAnchorId: string | null): Observable<ProjectDto> {
    return this.http.patch<ProjectDto>(`${this.base}/projects/${projectId}/parent-anchor`, {
      parentAnchorId,
    });
  }

  getPortfolioDashboard(anchorId: string): Observable<PortfolioDashboardDto> {
    return this.http.get<PortfolioDashboardDto>(`${this.base}/projects/${anchorId}/portfolio`);
  }

  getPortfolioFeeQuote(anchorId: string, phase: ReviewPhase): Observable<PortfolioFeeQuoteDto> {
    return this.http.get<PortfolioFeeQuoteDto>(
      `${this.base}/projects/${anchorId}/portfolio/fee-quote`,
      { params: { phase } },
    );
  }

  portfolioSubmit(anchorId: string, phase: ReviewPhase): Observable<BatchSubmitResult> {
    return this.http.post<BatchSubmitResult>(
      `${this.base}/projects/${anchorId}/portfolio/submit`,
      { phase },
    );
  }

  portfolioPayAndSubmit(anchorId: string, phase: ReviewPhase): Observable<BatchSubmitResult> {
    return this.http.post<BatchSubmitResult>(
      `${this.base}/projects/${anchorId}/portfolio/pay-and-submit`,
      { phase },
    );
  }

  // ── Unit 7: Dashboards & Notifications ────────────────────────────

  listNotifications(limit = 20, cursor?: string): Observable<NotificationPageDto> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<NotificationPageDto>(`${this.base}/notifications`, { params });
  }

  unreadNotificationCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(`${this.base}/notifications/unread-count`);
  }

  markNotificationRead(id: string): Observable<NotificationDto> {
    return this.http.post<NotificationDto>(`${this.base}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/read-all`, {});
  }

  getProjectDashboard(): Observable<DashboardDto> {
    return this.http.get<DashboardDto>(`${this.base}/dashboards/project`);
  }

  getGreenRaterDashboard(): Observable<DashboardDto> {
    return this.http.get<DashboardDto>(`${this.base}/dashboards/green-rater`);
  }

  getReviewerDashboard(): Observable<ReviewerDashboardDto> {
    return this.http.get<ReviewerDashboardDto>(`${this.base}/reviews/assigned`);
  }

  getAdminPipeline(params: Record<string, string> = {}): Observable<AdminPipelinePageDto> {
    return this.http.get<AdminPipelinePageDto>(`${this.base}/admin/pipeline`, { params });
  }
}
