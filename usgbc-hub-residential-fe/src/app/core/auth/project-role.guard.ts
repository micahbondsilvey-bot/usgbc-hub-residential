import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiClient } from '../api/api-client';
import { ProjectRole } from '../api/dto';

/**
 * Route guard for per-project authorization. Configure via route data:
 *   data: { allowedProjectRoles: ['PROJECT_TEAM','GREEN_RATER'] }  // or ['*']
 * Allows Admins unconditionally; otherwise checks the caller's resolved role.
 */
export const projectRoleGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const api = inject(ApiClient);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  const projectId = route.paramMap.get('projectId');
  if (!projectId) return router.createUrlTree(['/forbidden']);

  const allowed = (route.data['allowedProjectRoles'] as (ProjectRole | '*')[] | undefined) ?? [
    '*',
  ];

  try {
    const { projectRole } = await firstValueFrom(api.meRole(projectId));
    if (!projectRole) return router.createUrlTree(['/forbidden']);
    if (allowed.includes('*') || allowed.includes(projectRole)) return true;
  } catch {
    return router.createUrlTree(['/forbidden']);
  }
  return router.createUrlTree(['/forbidden']);
};
