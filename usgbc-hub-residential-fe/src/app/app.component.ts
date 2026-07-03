import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { NotificationBellComponent } from './core/notifications/notification-bell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NotificationBellComponent],
  template: `
    <header class="app-header">
      <a routerLink="/" class="brand">USGBC Hub · Residential</a>
      <nav>
        @if (auth.isAuthenticated()) {
          <span class="who">{{ auth.currentUser()?.email }}</span>
          <a routerLink="/dashboard">Dashboard</a>
          <a routerLink="/projects">Projects</a>
          <a routerLink="/projects/register">Register</a>
          <a routerLink="/projects/00000000-0000-4000-8000-000000000001/scorecard">
            Demo scorecard
          </a>
          <a routerLink="/projects/00000000-0000-4000-8000-000000000001/workbook">
            Demo workbook
          </a>
          <a routerLink="/profile">Profile</a>
          <app-notification-bell />
          <button type="button" class="link" (click)="auth.logout()">Log out</button>
        } @else {
          <a routerLink="/login">Log in</a>
        }
      </nav>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .app-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1.25rem;
        background: var(--usgbc-green-dark);
        color: #fff;
      }
      .brand {
        color: #fff;
        font-weight: 700;
        text-decoration: none;
      }
      nav {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      nav a {
        color: #fff;
        text-decoration: none;
      }
      .who {
        opacity: 0.85;
        font-size: 0.9rem;
      }
      button.link {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
      }
    `,
  ],
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
