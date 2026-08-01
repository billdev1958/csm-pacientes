import { Pipe, PipeTransform } from '@angular/core';

/**
 * Recorta los segundos de una hora que llega del backend como "08:00:00".
 *
 * Las franjas de `POST /v1/appointment/schedules` traen `timeStart` y `timeEnd`
 * en ese formato, y la pantalla de agendado los imprimía tal cual: un botón que
 * decía "08:00:00" y un resumen "de 08:00:00 a 08:30:00". Los segundos siempre
 * son cero y no aportan nada, solo ruido en el elemento que el paciente lee para
 * decidir.
 *
 * Se queda en 24 h porque el resto de la aplicación ya usa HH:mm a través del
 * pipe `date`, y mezclar formatos en la misma pantalla se lee como un error.
 */
@Pipe({ name: 'clockTime' })
export class ClockTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    // Se parte por ':' en lugar de cortar por posición: una hora sin segundos
    // ("08:00") o con milisegundos debe seguir dando "08:00".
    const [hours, minutes] = value.split(':');
    return minutes === undefined ? value : `${hours}:${minutes}`;
  }
}
