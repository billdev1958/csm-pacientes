/**
 * Accesos rápidos de fecha para el formulario de agendado.
 *
 * En teléfono, abrir el calendario nativo para pedir cita "mañana" son tres
 * toques y un cambio de contexto. Estos atajos cubren los días que concentran
 * casi todas las citas; el `<input type="date">` sigue ahí para el resto.
 */

/** Un día propuesto como atajo. */
export interface QuickDate {
  /** YYYY-MM-DD en hora local, que es el formato de `<input type="date">`. */
  value: string;
  /** "Hoy", "Mañana", "mié 5". */
  label: string;
}

/**
 * Formatea una fecha como YYYY-MM-DD **en hora local**.
 *
 * No sirve `toISOString().slice(0, 10)`: convierte a UTC, así que en México
 * (UTC-6) a partir de las 18:00 devuelve la fecha de mañana. Con eso, el `min`
 * del calendario prohibía agendar hoy durante toda la tarde.
 */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Etiqueta corta del atajo: los dos primeros días se nombran, el resto se fecha. */
function quickDateLabel(date: Date, offset: number): string {
  if (offset === 0) {
    return 'Hoy';
  }
  if (offset === 1) {
    return 'Mañana';
  }
  return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
}

/**
 * Construye `count` días consecutivos a partir de `from`, ambos incluidos.
 *
 * Se avanza con `setDate`, que normaliza el cambio de mes y de año y respeta los
 * cambios de horario de verano, en lugar de sumar milisegundos.
 */
export function buildQuickDates(from: Date, count: number): QuickDate[] {
  const dates: QuickDate[] = [];

  for (let offset = 0; offset < count; offset++) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    dates.push({ value: toDateInputValue(date), label: quickDateLabel(date, offset) });
  }

  return dates;
}
