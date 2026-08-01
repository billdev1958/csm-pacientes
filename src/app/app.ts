import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { TopAlert } from './shared/components/top-alert/top-alert';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TopAlert],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);

  protected readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  protected logout(): void {
    this.auth.logout();
  }
}
