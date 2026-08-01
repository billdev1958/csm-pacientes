import { Component, inject } from '@angular/core';

import { NotificationService } from '../../../core/services/notification.service';

/**
 * Notificaciones en la parte superior.
 *
 * Los atributos de región viva van en el contenedor externo, que está SIEMPRE en
 * el DOM: una región `aria-live` creada al mismo tiempo que su contenido no se
 * anuncia, porque el lector de pantalla necesita estar observándola de antes.
 *
 * La cortesía depende del tipo: un error interrumpe (`assertive`), una
 * confirmación espera un hueco en la lectura (`polite`).
 */
@Component({
  selector: 'app-top-alert',
  template: `
    <div
      class="alert-region"
      [attr.role]="notifications.current()?.type === 'error' ? 'alert' : 'status'"
      [attr.aria-live]="notifications.current()?.type === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      @if (notifications.current(); as alert) {
        <div class="alert" [class]="'alert--' + alert.type">
          <span class="alert__message">{{ alert.message }}</span>
          <button
            type="button"
            class="alert__close"
            aria-label="Cerrar notificación"
            (click)="notifications.hide()"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './top-alert.scss',
})
export class TopAlert {
  protected readonly notifications = inject(NotificationService);
}
