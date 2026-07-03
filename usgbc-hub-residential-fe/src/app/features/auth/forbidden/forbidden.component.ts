import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="card">
      <h1>Not authorized</h1>
      <p class="hint">You don't have permission to view that page.</p>
      <p class="hint"><a routerLink="/profile">Back to your profile</a></p>
    </section>
  `,
})
export class ForbiddenComponent {}
