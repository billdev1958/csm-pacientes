import { Appointment, AppointmentStatus } from '../../core/models/appointment.models';

/**
 * Agrupación y cuenta atrás de las citas del paciente.
 *
 * Vive fuera del componente por dos razones: son funciones puras que se pueden
 * probar sin montar la vista, y reciben el instante "ahora" como parámetro en
 * lugar de leer el reloj, así que una prueba puede fijar la fecha.
 */

/**
 * Estados en los que la cita ya no puede ocurrir. Una cita cancelada con fecha
 * futura pertenece al historial: la fecha sigue por delante, pero el paciente no
 * va a ir.
 */
const TERMINAL_STATUSES: readonly number[] = [
  AppointmentStatus.Concluida,
  AppointmentStatus.Cancelada,
];

/** Una cita con su etiqueta de cuenta atrás ya resuelta. */
export interface AppointmentEntry {
  appointment: Appointment;
  /** "Hoy", "Mañana", "En 5 días", "Ayer"… Vacío cuando no aplica. */
  countdown: string;
}

export interface GroupedAppointments {
  /** Las que todavía pueden ocurrir, de la más cercana a la más lejana. */
  upcoming: AppointmentEntry[];
  /** Las concluidas, canceladas y pasadas, de la más reciente a la más antigua. */
  history: AppointmentEntry[];
}

const MS_PER_DAY = 86_400_000;

/**
 * Días de calendario entre dos instantes, contados de medianoche a medianoche.
 *
 * No son periodos de 24 horas: una cita mañana a las 08:00 vista hoy a las 20:00
 * está a 12 horas, pero la respuesta útil para el paciente es "Mañana", no "Hoy".
 *
 * Se normaliza a UTC solo para restar. Los componentes de la fecha se toman en
 * hora local (`getFullYear`, `getMonth`, `getDate`), así que el resultado cuenta
 * días locales y un cambio de horario de verano no añade ni quita uno.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromMidnight = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toMidnight = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight - fromMidnight) / MS_PER_DAY);
}

/**
 * Traduce una distancia en días de calendario a la frase que responde la
 * pregunta con la que alguien abre esta pantalla: no "qué fecha es", sino
 * "cuánto falta".
 */
export function countdownLabel(days: number): string {
  if (days === 0) {
    return 'Hoy';
  }
  if (days === 1) {
    return 'Mañana';
  }
  if (days === -1) {
    return 'Ayer';
  }
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}

/**
 * Decide si una cita todavía puede ocurrir.
 *
 * Se compara con `timeEnd` y no con `timeStart` para que una cita en curso siga
 * contando como próxima mientras dura. Una fecha ilegible da NaN, que no supera
 * la comparación y manda la cita al historial: es el lado seguro, porque no
 * promete al paciente algo que no se puede verificar.
 */
function isUpcoming(appointment: Appointment, now: Date): boolean {
  if (appointment.statusID !== undefined && TERMINAL_STATUSES.includes(appointment.statusID)) {
    return false;
  }
  const end = new Date(appointment.timeEnd ?? appointment.timeStart).getTime();
  return end >= now.getTime();
}

function startTime(appointment: Appointment): number {
  return new Date(appointment.timeStart).getTime();
}

/**
 * Reparte las citas en "Próximas" e "Historial" y les pone su cuenta atrás.
 *
 * El backend devuelve una única lista en orden ascendente, así que sin agrupar
 * lo primero que ve el paciente es su cita más antigua —normalmente una
 * cancelada de hace meses— y la próxima queda enterrada al final.
 */
export function groupAppointments(
  appointments: readonly Appointment[],
  now: Date,
): GroupedAppointments {
  const upcoming: AppointmentEntry[] = [];
  const history: AppointmentEntry[] = [];

  for (const appointment of appointments) {
    const days = calendarDaysBetween(now, new Date(appointment.timeStart));

    if (isUpcoming(appointment, now)) {
      upcoming.push({ appointment, countdown: countdownLabel(days) });
      continue;
    }

    // En el historial la cuenta atrás solo tiene sentido hacia el pasado. Una
    // cita cancelada para mañana no lleva etiqueta: decir "Mañana" sugeriría que
    // sigue en pie.
    history.push({ appointment, countdown: days < 0 ? countdownLabel(days) : '' });
  }

  upcoming.sort((a, b) => startTime(a.appointment) - startTime(b.appointment));
  history.sort((a, b) => startTime(b.appointment) - startTime(a.appointment));

  return { upcoming, history };
}
