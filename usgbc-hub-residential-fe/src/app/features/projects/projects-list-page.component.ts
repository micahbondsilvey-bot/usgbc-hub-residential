import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { ProjectDto } from '../../core/api/dto';

@Component({
  selector: 'app-projects-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="wrap">
      <header class="head">
        <h1>Projects</h1>
        <a class="primary-link" routerLink="/projects/register">Register a project</a>
      </header>
      @if (loading()) {
        <p class="hint">Loading…</p>
      } @else if (projects().length === 0) {
        <p class="hint">No projects yet. Register your first one.</p>
      } @else {
        <table>
          <thead>
            <tr><th>GBCI ID</th><th>Name</th><th>Status</th><th>Target</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of projects(); track p.id) {
              <tr>
                <td>{{ p.gbciDisplayId ?? '—' }}</td>
                <td>{{ p.name }}</td>
                <td><span class="status">{{ p.status }}</span></td>
                <td>{{ p.targetCertificationLevel ?? '—' }}</td>
                <td><a [routerLink]="['/projects', p.id]">Open</a></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 900px; margin: 1.5rem auto; padding: 0 1rem; }
      .head { display: flex; justify-content: space-between; align-items: center; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--usgbc-border); border-radius: 8px; }
      th, td { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid var(--usgbc-border); }
      .status { font-size: 0.75rem; font-weight: 700; color: var(--usgbc-green-dark); }
      .primary-link { font-weight: 600; }
    `,
  ],
})
export class ProjectsListPageComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly projects = signal<ProjectDto[]>([]);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      this.projects.set(await firstValueFrom(this.api.listProjects(true)));
    } finally {
      this.loading.set(false);
    }
  }
}
