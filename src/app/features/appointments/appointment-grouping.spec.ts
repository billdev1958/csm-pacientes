import { Appointment } from '../../core/models/appointment.models';
import {
  appointmentCountLabel,
  calendarDaysBetween,
  countdownLabel,
  groupAppointments,
} from './appointment-grouping';

/** Cita mínima: solo importan aquí la fecha y el estado. */
function cita(id: string, timeStart: string, statusID: number, timeEnd?: string): Appointment {
  return {
    appointmentID: id,
    officeScheduleID: 1,
    doctorID: '11111111-1111-1111-1111-111111111111',
    doctorName: 'Dra. Demo Doctora',
    accountID: '22222222-2222-2222-2222-222222222222',
    patientID: '22222222-2222-2222-2222-222222222222',
    fullName: 'Prueba Portal Pacientes',
    medicalHistoryID: 'MH-1',
    serviceID: 13,
    shiftID: 1,
    officeName: 'Consultorio 3',
    serviceName: 'Medicina general matutino',
    timeStart,
    timeEnd,
    statusID,
  };
}

/** Fecha local, para que la prueba no dependa de la zona horaria de la máquina. */
function local(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

/** Cadena ISO de una fecha local; es lo que el backend devuelve en `timeStart`. */
function iso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return local(year, month, day, hour, minute).toISOString();
}

describe('calendarDaysBetween', () => {
  it('cuenta días de calendario, no periodos de 24 horas', () => {
    // De las 20:00 de hoy a las 08:00 de mañana hay 12 horas, pero la respuesta
    // que espera el paciente es "mañana", es decir un día de calendario.
    const hoyPorLaNoche = local(2026, 8, 1, 20, 0);
    const mananaTemprano = local(2026, 8, 2, 8, 0);
    expect(calendarDaysBetween(hoyPorLaNoche, mananaTemprano)).toBe(1);
  });

  it('da cero dentro del mismo día por lejos que estén las horas', () => {
    expect(calendarDaysBetween(local(2026, 8, 1, 0, 1), local(2026, 8, 1, 23, 59))).toBe(0);
  });

  it('cuenta hacia atrás con signo negativo', () => {
    expect(calendarDaysBetween(local(2026, 8, 10), local(2026, 8, 3))).toBe(-7);
  });

  it('cruza el cambio de mes y de año', () => {
    expect(calendarDaysBetween(local(2026, 8, 30), local(2026, 9, 2))).toBe(3);
    expect(calendarDaysBetween(local(2026, 12, 31), local(2027, 1, 1))).toBe(1);
  });
});

describe('countdownLabel', () => {
  it('nombra los días cercanos en lugar de contarlos', () => {
    expect(countdownLabel(0)).toBe('Hoy');
    expect(countdownLabel(1)).toBe('Mañana');
    expect(countdownLabel(-1)).toBe('Ayer');
  });

  it('cuenta los días a partir del segundo', () => {
    expect(countdownLabel(5)).toBe('En 5 días');
    expect(countdownLabel(-5)).toBe('Hace 5 días');
  });
});

describe('appointmentCountLabel', () => {
  it('concuerda el singular y el plural', () => {
    expect(appointmentCountLabel(1)).toBe('1 cita');
    expect(appointmentCountLabel(3)).toBe('3 citas');
  });

  // La insignia solo se pinta cuando el grupo tiene contenido, pero el cero no
  // debe producir "0 cita".
  it('trata el cero como plural', () => {
    expect(appointmentCountLabel(0)).toBe('0 citas');
  });
});

describe('groupAppointments', () => {
  const ahora = local(2026, 8, 1, 12, 0);

  it('separa lo que puede ocurrir de lo que ya no', () => {
    const { upcoming, history } = groupAppointments(
      [cita('futura', iso(2026, 8, 5, 9, 0), 1), cita('pasada', iso(2026, 5, 4, 9, 0), 4)],
      ahora,
    );

    expect(upcoming.map((e) => e.appointment.appointmentID)).toEqual(['futura']);
    expect(history.map((e) => e.appointment.appointmentID)).toEqual(['pasada']);
  });

  // El caso concreto que motivó la agrupación: el backend ordena ascendente y
  // devuelve la cancelada primero, así que era lo primero que veía el paciente.
  it('manda al historial una cita cancelada aunque su fecha sea futura', () => {
    const { upcoming, history } = groupAppointments(
      [cita('cancelada', iso(2026, 8, 20, 9, 0), 5)],
      ahora,
    );

    expect(upcoming).toEqual([]);
    expect(history.map((e) => e.appointment.appointmentID)).toEqual(['cancelada']);
  });

  it('no le pone cuenta atrás a una cancelada con fecha futura', () => {
    // Decir "En 19 días" sugeriría que la cita sigue en pie.
    const { history } = groupAppointments([cita('cancelada', iso(2026, 8, 20, 9, 0), 5)], ahora);
    expect(history[0].countdown).toBe('');
  });

  it('ordena las próximas de la más cercana a la más lejana', () => {
    const { upcoming } = groupAppointments(
      [
        cita('lejana', iso(2026, 9, 1, 9, 0), 1),
        cita('cercana', iso(2026, 8, 2, 9, 0), 2),
        cita('media', iso(2026, 8, 10, 9, 0), 1),
      ],
      ahora,
    );

    expect(upcoming.map((e) => e.appointment.appointmentID)).toEqual([
      'cercana',
      'media',
      'lejana',
    ]);
  });

  it('ordena el historial de lo más reciente a lo más antiguo', () => {
    const { history } = groupAppointments(
      [cita('vieja', iso(2025, 1, 4, 9, 0), 4), cita('reciente', iso(2026, 7, 28, 9, 0), 4)],
      ahora,
    );

    expect(history.map((e) => e.appointment.appointmentID)).toEqual(['reciente', 'vieja']);
  });

  it('etiqueta la cuenta atrás de las próximas', () => {
    const { upcoming } = groupAppointments(
      [
        cita('hoy', iso(2026, 8, 1, 18, 0), 1),
        cita('manana', iso(2026, 8, 2, 9, 0), 1),
        cita('en-cinco', iso(2026, 8, 6, 9, 0), 1),
      ],
      ahora,
    );

    expect(upcoming.map((e) => e.countdown)).toEqual(['Hoy', 'Mañana', 'En 5 días']);
  });

  // Se compara con `timeEnd` y no con `timeStart` para que una consulta en curso
  // no desaparezca de "Próximas" en cuanto da la hora de inicio.
  it('mantiene en próximas una cita que empezó pero no ha terminado', () => {
    const { upcoming } = groupAppointments(
      [cita('en-curso', iso(2026, 8, 1, 11, 30), 3, iso(2026, 8, 1, 12, 30))],
      ahora,
    );

    expect(upcoming.map((e) => e.appointment.appointmentID)).toEqual(['en-curso']);
  });

  it('manda al historial una cita pendiente cuya hora ya pasó', () => {
    // Nadie la cerró en el sistema, pero prometer que es "próxima" sería falso.
    const { upcoming, history } = groupAppointments(
      [cita('olvidada', iso(2026, 7, 20, 9, 0), 1)],
      ahora,
    );

    expect(upcoming).toEqual([]);
    expect(history[0].countdown).toBe('Hace 12 días');
  });

  it('tolera una lista vacía', () => {
    expect(groupAppointments([], ahora)).toEqual({ upcoming: [], history: [] });
  });
});
