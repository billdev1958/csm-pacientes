import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  message: string;
  type: NotificationType;
}

/**
 * Notificaciones efímeras (confirmaciones y errores) en la parte superior.
 *
 * El componente que las pinta declara una región `aria-live`, así que lo que se
 * emita aquí lo anuncia un lector de pantalla.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = signal<Notification | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly current = this.state.asReadonly();

  show(message: string, type: NotificationType = 'info', durationMs = 5000): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.state.set({ message, type });
    this.timer = setTimeout(() => this.hide(), durationMs);
  }

  hide(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.set(null);
  }
}
