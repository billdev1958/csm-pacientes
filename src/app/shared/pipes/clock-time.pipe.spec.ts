import { ClockTimePipe } from './clock-time.pipe';

describe('ClockTimePipe', () => {
  const pipe = new ClockTimePipe();

  it('recorta los segundos de la hora que envía el backend', () => {
    expect(pipe.transform('08:00:00')).toBe('08:00');
    expect(pipe.transform('13:30:00')).toBe('13:30');
  });

  it('deja intacta una hora que ya viene sin segundos', () => {
    expect(pipe.transform('08:00')).toBe('08:00');
  });

  it('ignora los milisegundos si algún día llegaran', () => {
    expect(pipe.transform('08:00:00.000')).toBe('08:00');
  });

  // La hora es opcional en varios DTO (`timeEnd` lo es en `Appointment`), así que
  // el pipe tiene que tolerar el hueco sin imprimir "null" en la pantalla.
  it('devuelve cadena vacía cuando no hay hora', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  // Sin separador no hay nada que recortar: se devuelve tal cual en lugar de
  // inventar un formato.
  it('devuelve el valor original si no reconoce el formato', () => {
    expect(pipe.transform('mañana')).toBe('mañana');
  });
});
