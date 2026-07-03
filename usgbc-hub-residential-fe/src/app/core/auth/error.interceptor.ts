import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Surfaces backend error payloads and handles auth failures:
 * - 401 → clear local state and redirect to /login.
 * - 403 → route to the shared "Not authorized" page.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.logout(false);
        void router.navigate(['/login']);
      } else if (error.status === 403) {
        void router.navigate(['/forbidden']);
      }
      return throwError(() => error);
    }),
  );
};
