import { formatDate } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { Appointment } from '../../../core/models/appointment.models';

/** Icono de una fila de datos. La plantilla lo resuelve con `@switch`. */
export type AppointmentMetaIcon = 'clock' | 'patient' | 'doctor' | 'room';

/**
 * Un dato de la cita con su icono.
 *
 * El icono es la etiqueta visible y `label` la que oye un lector de pantalla:
 * "Prueba Portal Pacientes" a secas no dice que sea el paciente, y un dibujo no
 * se lee en voz alta.
 */
export interface AppointmentMetaRow {
  icon: AppointmentMetaIcon;
  label: string;
  value: string;
}

/**
 * Tono de la tarjeta.
 *
 * Un solo dato de tres valores y no dos banderas, porque son excluyentes: una
 * cita no puede ser a la vez la más próxima y parte del historial.
 */
export type AppointmentCardTone = 'next' | 'default' | 'muted';

const LOCALE = 'es-MX';

/**
 * "lunes, 9:00 a.m." → "Lunes, 9:00 a.m.".
 *
 * Se hace aquí y no con `text-transform: capitalize`, que en CSS actúa sobre
 * cada palabra y convertía "9:00 a.m." en "9:00 A.m.".
 */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  templateUrl: './appointment-card.html',
  styleUrl: './appointment-card.scss',
  host: {
    class: 'appt',
    '[class.appt--next]': "tone() === 'next'",
    '[class.appt--muted]': "tone() === 'muted'",
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

  /**
   * `next` destaca la cita más cercana, que es la que casi siempre se viene a
   * mirar; `muted` hunde las del historial con una capa tonal, sin bajarle el
   * contraste al texto.
   */
  readonly tone = input<AppointmentCardTone>('default');

  readonly cancelRequested = output<Appointment>();

  /** Con cero a la izquierda: en un bloque tipo calendario, "03" se lee como una
   * fecha y "3" como una cifra suelta, y además todas las tarjetas quedan del
   * mismo ancho. */
  protected readonly dayNumber = computed(() =>
    formatDate(this.appointment().timeStart, 'dd', LOCALE),
  );

  protected readonly monthShort = computed(() =>
    formatDate(this.appointment().timeStart, 'MMM', LOCALE),
  );

  protected readonly metaRows = computed<AppointmentMetaRow[]>(() => {
    const appt = this.appointment();
    return [
      {
        icon: 'clock',
        label: 'Fecha y hora',
        value: capitalizeFirst(formatDate(appt.timeStart, 'EEEE, h:mm a', LOCALE)),
      },
      { icon: 'patient', label: 'Paciente', value: appt.fullName },
      { icon: 'doctor', label: 'Médico', value: appt.doctorName },
      { icon: 'room', label: 'Consultorio', value: appt.officeName },
    ];
  });
}
