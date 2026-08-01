import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pasa a 12 horas una hora que llega del backend como "08:00:00".
 *
 * Las franjas de `POST /v1/appointment/schedules` traen `timeStart` y `timeEnd`
 * en ese formato, y la pantalla de agendado los imprimía tal cual: un botón que
 * decía "08:00:00" y un resumen "de 08:00:00 a 08:30:00".
 *
 * El formato de 24 h se lee como horario administrativo y obliga a traducir
 * mentalmente: "15:30" no es cómo nadie dice la hora de su cita. Se emite
 * "3:30 p.m.", que es lo mismo que produce el pipe `date` con el patrón
 * `h:mm a` en es-MX, de modo que las dos formas de mostrar la hora en la
 * aplicación coinciden carácter por carácter.
 */
@Pipe({ name: 'clockTime' })
export class ClockTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    // Se parte por ':' en lugar de cortar por posición: una hora sin segundos
    // ("08:00") o con milisegundos debe funcionar igual.
    const [rawHours, minutes] = value.split(':');
    const hours = Number(rawHours);
    if (minutes === undefined || !Number.isInteger(hours) || hours < 0 || hours > 23) {
      // Formato inesperado: se devuelve tal cual en lugar de inventar una hora.
      return value;
    }

    const period = hours < 12 ? 'a.m.' : 'p.m.';
    // Medianoche y mediodía son los dos casos que se escapan del módulo: las
    // 00:30 son 12:30 a.m. y las 12:30 son 12:30 p.m., no las 0:30.
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${minutes} ${period}`;
  }
}
