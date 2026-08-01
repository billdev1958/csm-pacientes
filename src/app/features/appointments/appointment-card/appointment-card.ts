import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { Appointment } from '../../../core/models/appointment.models';

/**
 * Tarjeta de una cita.
 *
 * Es puramente presentacional: no sabe qué estados se pueden cancelar ni cuánto
 * falta para la cita, todo eso llega resuelto desde la pantalla que la usa. Así
 * las dos listas que la reutilizan —próximas e historial— comparten el marcado
 * sin compartir reglas de negocio, y la política de cancelación sigue viviendo
 * en un solo sitio.
 */
@Component({
  selector: 'app-appointment-card',
  imports: [DatePipe],
  templateUrl: './appointment-card.html',
  styleUrl: './appointment-card.scss',
  host: {
    class: 'appt card',
    '[class.appt--next]': 'featured()',
  },
})
export class AppointmentCard {
  readonly appointment = input.required<Appointment>();

  /** "Hoy", "Mañana", "En 5 días"… Vacío si no aplica y entonces no se pinta. */
  readonly countdown = input('');

  /** Sufijo de la clase `badge--*`, ya traducido desde el id de estado. */
  readonly badgeModifier = input('pending');

  /** Lo decide el anfitrión con la lista de estados que el backend deja cancelar. */
  readonly canCancel = input(false);

  /** Hay una cancelación en curso para esta cita. */
  readonly cancelling = input(false);

  /** Destaca la cita más cercana, que es la que casi siempre se viene a mirar. */
  readonly featured = input(false);

  readonly cancelRequested = output<Appointment>();
}
