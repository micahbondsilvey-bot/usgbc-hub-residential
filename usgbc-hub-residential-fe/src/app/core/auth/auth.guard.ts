import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Requires an authenticated user; otherwise redirects to /login with redirectTo. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
  }

  // Hydrate the profile if we have a token but no user yet (e.g., after refresh).
  if (!auth.currentUser()) {
    try {
      await auth.refreshProfile();
    } catch {
      auth.logout(false);
      return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
    }
  }
  return true;
};
