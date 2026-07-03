import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { AuthService } from '../auth/auth.service';
import { NotificationDto } from '../api/dto';

/** Bell icon with unread count + dropdown (BR-N5, Q9). Polls every 30s while authenticated. */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bell">
      <button type="button" class="bell-btn" (click)="toggle()" aria-label="Notifications">
        🔔
        @if (unread() > 0) { <span class="badge">{{ unread() }}</span> }
      </button>
      @if (open()) {
        <div class="dropdown">
          <div class="dropdown-head">
            <strong>Notifications</strong>
            <button type="button" class="link" (click)="markAll()">Mark all read</button>
          </div>
          @if (items().length === 0) {
            <p class="empty">No notifications.</p>
          } @else {
            @for (n of items(); track n.id) {
              <button type="button" class="item" [class.unread]="!n.readAt" (click)="openItem(n)">
                <span class="subject">{{ n.subject }}</span>
                <span class="body">{{ n.bodyMarkdown }}</span>
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bell { position: relative; }
      .bell-btn { background: none; border: none; cursor: pointer; font-size: 1.2rem; position: relative; color: #fff; }
      .badge { position: absolute; top: -6px; right: -8px; background: #d9534f; color: #fff; border-radius: 999px; font-size: 0.65rem; padding: 0 0.35rem; }
      .dropdown { position: absolute; right: 0; top: 2rem; width: 320px; max-height: 420px; overflow: auto; background: #fff; color: var(--usgbc-ink); border: 1px solid var(--usgbc-border); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); z-index: 50; }
      .dropdown-head { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--usgbc-border); }
      .item { display: flex; flex-direction: column; gap: 0.15rem; width: 100%; text-align: left; border: none; border-bottom: 1px solid var(--usgbc-border); background: none; padding: 0.6rem 0.8rem; cursor: pointer; }
      .item.unread { background: #f0f6ec; }
      .item .subject { font-weight: 600; font-size: 0.85rem; }
      .item .body { font-size: 0.78rem; color: var(--usgbc-muted); }
      .empty { padding: 0.8rem; color: var(--usgbc-muted); }
      .link { background: none; border: none; color: var(--usgbc-green-dark); text-decoration: underline; cursor: pointer; font: inherit; font-size: 0.8rem; }
    `,
  ],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly unread = signal(0);
  readonly items = signal<NotificationDto[]>([]);
  readonly open = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    void this.refreshCount();
    this.timer = setInterval(() => {
      if (this.auth.isAuthenticated()) void this.refreshCount();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async toggle(): Promise<void> {
    this.open.set(!this.open());
    if (this.open()) await this.loadItems();
  }

  private async refreshCount(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      const { unreadCount } = await firstValueFrom(this.api.unreadNotificationCount());
      this.unread.set(unreadCount);
    } catch {
      /* ignore polling errors */
    }
  }

  private async loadItems(): Promise<void> {
    try {
      const page = await firstValueFrom(this.api.listNotifications(15));
      this.items.set(page.rows);
    } catch {
      /* ignore */
    }
  }

  async markAll(): Promise<void> {
    try {
      await firstValueFrom(this.api.markAllNotificationsRead());
      this.items.update((list) => list.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      this.unread.set(0);
    } catch {
      /* ignore */
    }
  }

  async openItem(n: NotificationDto): Promise<void> {
    if (!n.readAt) {
      try {
        await firstValueFrom(this.api.markNotificationRead(n.id));
        this.unread.update((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    this.open.set(false);
    if (n.link) void this.router.navigateByUrl(n.link);
  }
}
