import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShiftPicker, toShiftChoices } from './shift-picker';

describe('toShiftChoices', () => {
  it('pone a cada turno conocido su icono', () => {
    expect(
      toShiftChoices([
        { id: 1, name: 'Matutino' },
        { id: 2, name: 'Vespertino' },
      ]),
    ).toEqual([
      { id: '1', name: 'Matutino', icon: 'morning' },
      { id: '2', name: 'Vespertino', icon: 'afternoon' },
    ]);
  });

  // Un turno nuevo en la base no puede dejar al paciente sin poder elegirlo: se
  // pinta la tarjeta sin icono.
  it('pinta sin icono un turno que no reconoce, pero lo pinta', () => {
    expect(toShiftChoices([{ id: 7, name: 'Nocturno' }])).toEqual([
      { id: '7', name: 'Nocturno', icon: 'none' },
    ]);
  });

  // El control del formulario guarda texto, como cuando esto era un <select>.
  it('convierte el id a cadena', () => {
    expect(toShiftChoices([{ id: 2, name: 'Vespertino' }])[0].id).toBe('2');
  });

  it('tolera que el backend no devuelva turnos', () => {
    expect(toShiftChoices([])).toEqual([]);
  });
});

describe('ShiftPicker', () => {
  let fixture: ComponentFixture<ShiftPicker>;

  const TURNOS = toShiftChoices([
    { id: 1, name: 'Matutino' },
    { id: 2, name: 'Vespertino' },
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShiftPicker] }).compileComponents();
    fixture = TestBed.createComponent(ShiftPicker);
    fixture.componentRef.setInput('options', TURNOS);
  });

  async function montar(selected = '') {
    fixture.componentRef.setInput('selected', selected);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta una tarjeta por turno, con radios de verdad y su grupo', async () => {
    const raiz = await montar();
    expect(raiz.querySelectorAll('.shift').length).toBe(2);
    expect(raiz.querySelectorAll('input[type="radio"]').length).toBe(2);
    // El fieldset y su legend son lo que anuncia el grupo a un lector de pantalla.
    expect(raiz.querySelector('fieldset > legend')?.textContent?.trim()).toBe('Turno');
  });

  it('marca el turno elegido en el radio y en la tarjeta', async () => {
    const raiz = await montar('2');
    const radios = raiz.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(raiz.querySelectorAll('.shift')[1].className).toContain('shift--selected');
  });

  it('avisa del turno elegido con su id', async () => {
    const raiz = await montar();
    let elegido: string | null = null;
    fixture.componentInstance.selectedChange.subscribe((id) => (elegido = id));

    raiz.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();

    expect(elegido).toBe('2');
  });

  it('los iconos no se anuncian: la etiqueta es el nombre del turno', async () => {
    const raiz = await montar();
    const iconos = Array.from(raiz.querySelectorAll('svg'));
    expect(iconos.length).toBe(2);
    expect(iconos.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
