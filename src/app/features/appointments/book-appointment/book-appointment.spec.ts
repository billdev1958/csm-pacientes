import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentParams, OfficeSchedule } from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { BookAppointment } from './book-appointment';

const PARAMS: AppointmentParams = {
  patients: {
    accountHolderID: '11111111-1111-1111-1111-111111111111',
    fullName: 'Prueba Portal Pacientes',
    benefeciaries: [],
  },
  services: [{ id: 13, name: 'Medicina general matutino' }],
  shifts: [{ id: 1, name: 'Matutino' }],
};

const FRANJAS: OfficeSchedule[] = [
  {
    id: 1,
    timeStart: '08:00:00',
    timeEnd: '08:30:00',
    timeDuration: '30m',
    officeName: 'Consultorio 3: Medicina general matutino',
    statusID: 1,
    shiftID: 1,
  },
  {
    id: 2,
    timeStart: '08:30:00',
    timeEnd: '09:00:00',
    timeDuration: '30m',
    officeName: 'Consultorio 3: Medicina general matutino',
    statusID: 2,
    shiftID: 1,
  },
];

describe('BookAppointment', () => {
  let fixture: ComponentFixture<BookAppointment>;
  let component: BookAppointment;

  beforeEach(async () => {
    const servicio = {
      getParams: () => of(PARAMS),
      getAvailableSchedules: () => of(FRANJAS),
      createAppointment: () => of({ status: 'success' as const }),
    };

    await TestBed.configureTestingModule({
      imports: [BookAppointment],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AppointmentService, useValue: servicio },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookAppointment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Accede a los miembros protegidos que la plantilla usa. */
  function api() {
    return component as unknown as {
      form: {
        controls: Record<string, { setValue: (v: string) => void }>;
        patchValue: (v: Record<string, string>) => void;
      };
      schedules: () => OfficeSchedule[];
      selectedScheduleId: () => number | null;
      availableSchedules: () => OfficeSchedule[];
      occupiedCount: () => number;
      officeNames: () => string[];
      currentStep: () => number;
      hasSearched: () => boolean;
      selectSchedule: (s: OfficeSchedule) => void;
      chooseDate: (v: string) => void;
    };
  }

  /** Completa la combinación —que ya dispara la búsqueda sola— y elige franja. */
  function elegirFranja() {
    const c = api();
    c.form.patchValue({ serviceID: '13', shiftID: '1', appointmentDate: '2026-08-03' });
    c.selectSchedule(FRANJAS[0]);
  }

  it('carga los parámetros al iniciar y no busca nada todavía', () => {
    expect(api().schedules().length).toBe(0);
    expect(api().hasSearched()).toBe(false);
  });

  // Antes había que pulsar "Ver horarios disponibles" aunque los tres campos ya
  // estuvieran completos: un paso más sin información nueva que aportar.
  it('busca sola en cuanto la combinación está completa', () => {
    api().form.patchValue({ serviceID: '13', shiftID: '1', appointmentDate: '2026-08-03' });

    expect(api().hasSearched()).toBe(true);
    expect(api().schedules().length).toBe(2);
  });

  it('no busca mientras falte alguno de los tres campos', () => {
    api().form.patchValue({ serviceID: '13', shiftID: '1' });
    expect(api().hasSearched()).toBe(false);
  });

  it('separa las franjas disponibles de las ocupadas', () => {
    elegirFranja();
    expect(api().schedules().length).toBe(2);
    expect(api().availableSchedules().length).toBe(1);
    expect(api().occupiedCount()).toBe(1);
  });

  // El nombre del consultorio ya incluye el servicio, así que se muestra una vez
  // como contexto de la sección en lugar de bajo cada franja.
  it('reconoce que todas las franjas son del mismo consultorio', () => {
    elegirFranja();
    expect(api().officeNames()).toEqual(['Consultorio 3: Medicina general matutino']);
  });

  it('mueve el paso actual conforme avanza el agendado', () => {
    expect(api().currentStep()).toBe(1);

    api().form.patchValue({ serviceID: '13', shiftID: '1', appointmentDate: '2026-08-03' });
    expect(api().currentStep()).toBe(2);

    api().selectSchedule(FRANJAS[0]);
    expect(api().currentStep()).toBe(3);
  });

  it('el atajo de fecha rellena el campo y dispara la búsqueda', () => {
    api().form.patchValue({ serviceID: '13', shiftID: '1' });
    api().chooseDate('2026-08-04');

    expect(api().hasSearched()).toBe(true);
  });

  // Este es el caso que rompía: la suscripción escuchaba el formulario completo,
  // así que teclear en "motivo" borraba la selección y el bloque de confirmación
  // desaparecía del DOM con el foco dentro.
  it('escribir el motivo NO borra la franja elegida', () => {
    elegirFranja();
    expect(api().selectedScheduleId()).toBe(1);

    api().form.controls['reason'].setValue('Revisión general');

    expect(api().selectedScheduleId()).toBe(1);
    expect(api().schedules().length).toBe(2);
  });

  it('escribir los síntomas tampoco la borra', () => {
    elegirFranja();
    api().form.controls['symptoms'].setValue('Dolor de cabeza desde ayer');
    expect(api().selectedScheduleId()).toBe(1);
  });

  it('cambiar de paciente tampoco la borra: no altera qué franjas existen', () => {
    elegirFranja();
    api().form.controls['beneficiaryID'].setValue('22222222-2222-2222-2222-222222222222');
    expect(api().selectedScheduleId()).toBe(1);
  });

  // Con la búsqueda automática la lista se repuebla enseguida, así que lo que hay
  // que garantizar es que la franja elegida NO sobreviva al cambio: dejarla
  // permitiría reservar una franja de otra combinación.
  it('cambiar el servicio suelta la franja elegida', () => {
    elegirFranja();
    api().form.controls['serviceID'].setValue('8');
    expect(api().selectedScheduleId()).toBeNull();
  });

  it('cambiar la fecha suelta la franja elegida', () => {
    elegirFranja();
    api().form.controls['appointmentDate'].setValue('2026-08-04');
    expect(api().selectedScheduleId()).toBeNull();
  });

  it('cambiar el turno suelta la franja elegida', () => {
    elegirFranja();
    api().form.controls['shiftID'].setValue('2');
    expect(api().selectedScheduleId()).toBeNull();
  });
});
