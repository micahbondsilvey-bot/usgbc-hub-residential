import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { projectRoleGuard } from './core/auth/project-role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'auth/password/reset/request',
    loadComponent: () =>
      import('./features/auth/password-reset/request-reset.component').then(
        (m) => m.RequestResetComponent,
      ),
  },
  {
    path: 'auth/password/reset',
    loadComponent: () =>
      import('./features/auth/password-reset/confirm-reset.component').then(
        (m) => m.ConfirmResetComponent,
      ),
  },
  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'invitations/accept',
    loadComponent: () =>
      import('./features/auth/invite-accept/invite-accept.component').then(
        (m) => m.InviteAcceptComponent,
      ),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/auth/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/projects-list-page.component').then(
        (m) => m.ProjectsListPageComponent,
      ),
  },
  {
    path: 'projects/register',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/registration/registration-page.component').then(
        (m) => m.RegistrationPageComponent,
      ),
  },
  {
    path: 'projects/bulk',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bulk/bulk-upload-page.component').then((m) => m.BulkUploadPageComponent),
  },
  {
    path: 'projects/:projectId/scorecard',
    canActivate: [authGuard, projectRoleGuard],
    data: { allowedProjectRoles: ['*'] },
    loadComponent: () =>
      import('./features/scorecard/scorecard-page/scorecard-page.component').then(
        (m) => m.ScorecardPageComponent,
      ),
  },
  {
    path: 'projects/:projectId/workbook',
    canActivate: [authGuard, projectRoleGuard],
    data: { allowedProjectRoles: ['*'] },
    loadComponent: () =>
      import('./features/workbook/workbook-page.component').then((m) => m.WorkbookPageComponent),
  },
  {
    path: 'projects/:projectId/review',
    canActivate: [authGuard, projectRoleGuard],
    data: { allowedProjectRoles: ['*'] },
    loadComponent: () =>
      import('./features/review/review-page.component').then((m) => m.ReviewPageComponent),
  },
  {
    path: 'projects/:projectId/portfolio',
    canActivate: [authGuard, projectRoleGuard],
    data: { allowedProjectRoles: ['*'] },
    loadComponent: () =>
      import('./features/portfolio/portfolio-page.component').then((m) => m.PortfolioPageComponent),
  },
  {
    path: 'projects/:projectId',
    canActivate: [authGuard, projectRoleGuard],
    data: { allowedProjectRoles: ['*'] },
    loadComponent: () =>
      import('./features/projects/project-detail-page.component').then(
        (m) => m.ProjectDetailPageComponent,
      ),
  },
  { path: '**', redirectTo: 'login' },
];
