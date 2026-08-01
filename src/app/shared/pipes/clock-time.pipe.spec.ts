import { ClockTimePipe } from './clock-time.pipe';

describe('ClockTimePipe', () => {
  const pipe = new ClockTimePipe();

  it('pasa a 12 horas la hora que envía el backend', () => {
    expect(pipe.transform('08:00:00')).toBe('8:00 a.m.');
    expect(pipe.transform('13:30:00')).toBe('1:30 p.m.');
  });

  it('acepta una hora que ya viene sin segundos', () => {
    expect(pipe.transform('09:15')).toBe('9:15 a.m.');
  });

  it('ignora los milisegundos si algún día llegaran', () => {
    expect(pipe.transform('08:00:00.000')).toBe('8:00 a.m.');
  });

  // Los dos casos que no salen del módulo 12: las 00:30 son 12:30 a.m. y las
  // 12:30 son 12:30 p.m., no las 0:30 de nada.
  it('nombra bien la medianoche y el mediodía', () => {
    expect(pipe.transform('00:30:00')).toBe('12:30 a.m.');
    expect(pipe.transform('12:00:00')).toBe('12:00 p.m.');
    expect(pipe.transform('12:45:00')).toBe('12:45 p.m.');
    expect(pipe.transform('23:59:00')).toBe('11:59 p.m.');
  });

  // Debe coincidir carácter por carácter con lo que produce el pipe `date` con
  // el patrón `h:mm a` en es-MX, que es lo que usa la lista de citas. Si Angular
  // cambiara esa salida, tener las dos formas descuadradas se vería como un
  // error de la aplicación.
  it('usa la misma notación que el pipe date en es-MX', () => {
    expect(pipe.transform('09:00:00')).toBe('9:00 a.m.');
    expect(pipe.transform('15:30:00')).toBe('3:30 p.m.');
  });

  // La hora es opcional en varios DTO (`timeEnd` lo es en `Appointment`), así que
  // el pipe tiene que tolerar el hueco sin imprimir "null" en la pantalla.
  it('devuelve cadena vacía cuando no hay hora', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  // Sin separador, o con una hora imposible, no hay nada que convertir: se
  // devuelve tal cual en lugar de inventar un formato.
  it('devuelve el valor original si no reconoce el formato', () => {
    expect(pipe.transform('mañana')).toBe('mañana');
    expect(pipe.transform('99:00:00')).toBe('99:00:00');
  });
});
