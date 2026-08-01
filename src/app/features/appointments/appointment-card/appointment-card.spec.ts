import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Appointment } from '../../../core/models/appointment.models';
import { AppointmentCard } from './appointment-card';

/**
 * Cita de las 9:00 de un lunes en hora LOCAL: `formatDate` pinta en la zona de
 * la máquina, así que fijar la hora en UTC haría que la prueba dependiera de
 * dónde se ejecuta.
 */
const LUNES_9AM = new Date(2026, 7, 3, 9, 0).toISOString();

function cita(overrides: Partial<Appointment> = {}): Appointment {
  return {
    appointmentID: '00000001-0000-0000-0000-000000000000',
    officeScheduleID: 1,
    doctorID: '11111111-1111-1111-1111-111111111111',
    doctorName: 'Dra. Demo Doctora',
    accountID: '22222222-2222-2222-2222-222222222222',
    patientID: '22222222-2222-2222-2222-222222222222',
    fullName: 'Prueba Portal Pacientes',
    medicalHistoryID: 'MH-1',
    serviceID: 13,
    shiftID: 1,
    officeName: 'Consultorio 3: Medicina general matutino',
    serviceName: 'Medicina general matutino',
    timeStart: LUNES_9AM,
    statusID: 1,
    statusName: 'Pendiente',
    ...overrides,
  };
}

describe('AppointmentCard', () => {
  let fixture: ComponentFixture<AppointmentCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppointmentCard] }).compileComponents();
  });

  /** Monta una tarjeta. Se puede llamar varias veces por prueba para comparar. */
  async function montar(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AppointmentCard);
    fixture.componentRef.setInput('appointment', cita());
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function textos(raiz: HTMLElement, selector: string): string[] {
    return Array.from(raiz.querySelectorAll(selector)).map((el) => el.textContent?.trim() ?? '');
  }

  // El defecto concreto: la hora se capitalizaba con `text-transform: capitalize`,
  // que en CSS actúa sobre cada palabra, así que "9:00 a.m." se pintaba
  // "9:00 A.m.". Ahora se capitaliza solo la inicial, en TypeScript.
  it('capitaliza el día de la semana y deja a.m. en minúsculas', async () => {
    const raiz = await montar();
    expect(textos(raiz, '.appt__row-value')[0]).toBe('Lunes, 9:00 a.m.');
  });

  // El día va con cero a la izquierda para que el bloque se lea como una fecha de
  // calendario y todas las tarjetas ocupen lo mismo.
  it('pinta el bloque de fecha con el mes y el día a dos cifras', async () => {
    const raiz = await montar();
    expect(raiz.querySelector('.appt__month')?.textContent?.trim().toLowerCase()).toContain('ago');
    expect(raiz.querySelector('.appt__day')?.textContent?.trim()).toBe('03');
  });

  // Cada fila lleva un icono como etiqueta visible; sin el `dt` oculto, un lector
  // de pantalla leería "Prueba Portal Pacientes" sin decir que es el paciente.
  it('cada dato lleva su etiqueta para lector de pantalla', async () => {
    const raiz = await montar();
    const etiquetas = textos(raiz, '.appt__row-label .visually-hidden');
    expect(etiquetas).toEqual(['Fecha y hora', 'Paciente', 'Médico', 'Consultorio']);
    expect(textos(raiz, '.appt__row-value').slice(1)).toEqual([
      'Prueba Portal Pacientes',
      'Dra. Demo Doctora',
      'Consultorio 3: Medicina general matutino',
    ]);
  });

  it('los iconos no se anuncian: son la etiqueta visible, no información', async () => {
    const raiz = await montar();
    const iconos = Array.from(raiz.querySelectorAll('.appt__row-label svg'));
    expect(iconos.length).toBe(4);
    expect(iconos.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('el tono decide la clase del anfitrión', async () => {
    expect((await montar({ tone: 'next' })).className).toContain('appt--next');
    expect((await montar({ tone: 'muted' })).className).toContain('appt--muted');
    const normal = (await montar()).className;
    expect(normal).not.toContain('appt--next');
    expect(normal).not.toContain('appt--muted');
  });

  it('solo ofrece cancelar cuando el anfitrión lo permite', async () => {
    expect((await montar()).querySelector('.appt__cancel')).toBeNull();
    expect((await montar({ canCancel: true })).querySelector('.appt__cancel')).not.toBeNull();
  });

  it('avisa al anfitrión con la cita al pedir la cancelación', async () => {
    const raiz = await montar({ canCancel: true });
    let recibida: Appointment | null = null;
    fixture.componentInstance.cancelRequested.subscribe((a) => (recibida = a));

    raiz.querySelector<HTMLButtonElement>('.appt__cancel')?.click();

    expect(recibida).not.toBeNull();
    expect(recibida!.appointmentID).toBe('00000001-0000-0000-0000-000000000000');
  });

  it('no pinta la cuenta atrás cuando llega vacía', async () => {
    expect((await montar()).querySelector('.appt__countdown')).toBeNull();
    expect(
      (await montar({ countdown: 'En 2 días' })).querySelector('.appt__countdown')?.textContent,
    ).toContain('En 2 días');
  });
});
