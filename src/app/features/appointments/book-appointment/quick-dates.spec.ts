import { buildQuickDates, toDateInputValue } from './quick-dates';

describe('toDateInputValue', () => {
  it('formatea la fecha local con ceros a la izquierda', () => {
    expect(toDateInputValue(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(toDateInputValue(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  // El defecto que corrige: `toISOString().slice(0, 10)` pasa por UTC, así que en
  // México (UTC-6) a las 20:00 devolvía la fecha de mañana y el `min` del
  // calendario prohibía agendar hoy durante toda la tarde.
  it('no se adelanta un día por la tarde', () => {
    expect(toDateInputValue(new Date(2026, 7, 3, 20, 0))).toBe('2026-08-03');
    expect(toDateInputValue(new Date(2026, 7, 3, 23, 59))).toBe('2026-08-03');
  });
});

describe('buildQuickDates', () => {
  it('nombra los dos primeros días y fecha el resto', () => {
    const dates = buildQuickDates(new Date(2026, 7, 3), 4);

    expect(dates.map((d) => d.label).slice(0, 2)).toEqual(['Hoy', 'Mañana']);
    // La etiqueta del resto la produce Intl y depende del ICU disponible, así que
    // se comprueba que lleve el día del mes en lugar de fijar la cadena entera.
    expect(dates[2].label).toContain('5');
    expect(dates[3].label).toContain('6');
  });

  it('genera días consecutivos empezando por el de hoy', () => {
    const dates = buildQuickDates(new Date(2026, 7, 3), 3);
    expect(dates.map((d) => d.value)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('cruza el cambio de mes y de año', () => {
    expect(buildQuickDates(new Date(2026, 7, 30), 3).map((d) => d.value)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
    expect(buildQuickDates(new Date(2026, 11, 31), 2).map((d) => d.value)).toEqual([
      '2026-12-31',
      '2027-01-01',
    ]);
  });
});
