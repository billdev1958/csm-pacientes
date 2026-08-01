import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../core/models/api.models';
import { AppointmentParams, OfficeSchedule } from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { NotificationService } from '../../../core/services/notification.service';
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

// Caso reproducido con dos cuentas reales contra la API: A reserva una franja y
// B, que la tenía en pantalla, confirma la misma. El backend responde 409 y la
// lista de B ya está desactualizada.
describe('BookAppointment ante una franja que se ocupó', () => {
  let fixture: ComponentFixture<BookAppointment>;
  let busquedas: number;

  beforeEach(async () => {
    busquedas = 0;
    const servicio = {
      getParams: () => of(PARAMS),
      getAvailableSchedules: () => {
        busquedas += 1;
        return of(FRANJAS);
      },
      createAppointment: () =>
        throwError(() => ({
          status: 409,
          error: { message: 'ese horario acaba de ser reservado; elige otro' },
        })),
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
    fixture.detectChanges();
  });

  function api() {
    return fixture.componentInstance as unknown as {
      form: { patchValue: (v: Record<string, string>) => void };
      selectedScheduleId: () => number | null;
      selectSchedule: (s: OfficeSchedule) => void;
      confirm: () => void;
    };
  }

  it('suelta la franja y vuelve a buscar cuando el servidor responde 409', () => {
    const c = api();
    c.form.patchValue({ serviceID: '13', shiftID: '1', appointmentDate: '2026-08-03' });
    const busquedasTrasElegirCombinacion = busquedas;
    c.selectSchedule(FRANJAS[0]);
    expect(c.selectedScheduleId()).toBe(FRANJAS[0].id);

    c.confirm();

    // Sin esto el paciente sigue viendo libre lo que ya no lo está y reintenta
    // la misma franja indefinidamente.
    expect(c.selectedScheduleId()).toBeNull();
    expect(busquedas).toBe(busquedasTrasElegirCombinacion + 1);
  });
});

/**
 * Refresco oportunista: el portal vuelve a preguntar por las franjas por cuenta
 * propia, para que una que otra persona acaba de tomar desaparezca antes de que
 * la pulses. Se prueba con temporizadores falsos porque el sondeo va cada
 * treinta segundos.
 */
describe('BookAppointment refrescando los horarios en segundo plano', () => {
  /** Tiene que coincidir con `REFRESH_INTERVAL_MS` del componente. */
  const SONDEO_MS = 30_000;

  let fixture: ComponentFixture<BookAppointment>;
  let busquedas: number;
  let respuesta: () => Observable<OfficeSchedule[]>;
  let creacion: () => Observable<ApiResponse>;

  /** jsdom sirve `visibilityState` desde el prototipo; esto lo sombrea. */
  function fijarVisibilidad(estado: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
  }

  beforeEach(async () => {
    busquedas = 0;
    respuesta = () => of(FRANJAS);
    creacion = () => of({ status: 'success' as const });
    fijarVisibilidad('visible');

    const servicio = {
      getParams: () => of(PARAMS),
      getAvailableSchedules: () => {
        busquedas += 1;
        return respuesta();
      },
      createAppointment: () => creacion(),
    };

    await TestBed.configureTestingModule({
      imports: [BookAppointment],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AppointmentService, useValue: servicio },
      ],
    }).compileComponents();

    // Después de compilar y antes de construir: el sondeo se suscribe en el
    // constructor, así que a partir de aquí el reloj tiene que ser el falso.
    vi.useFakeTimers();
    fixture = TestBed.createComponent(BookAppointment);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    fijarVisibilidad('visible');
  });

  function api() {
    return fixture.componentInstance as unknown as {
      form: { patchValue: (v: Record<string, string>) => void };
      schedules: () => OfficeSchedule[];
      selectedScheduleId: () => number | null;
      isLoadingSchedules: () => boolean;
      schedulesError: () => string | null;
      selectSchedule: (s: OfficeSchedule) => void;
      confirm: () => void;
    };
  }

  /** Deja la pantalla con horarios cargados y, si se pide, una franja elegida. */
  function verHorarios(eligiendo = false): void {
    api().form.patchValue({ serviceID: '13', shiftID: '1', appointmentDate: '2026-08-03' });
    if (eligiendo) {
      api().selectSchedule(FRANJAS[0]);
    }
  }

  it('vuelve a preguntar cada treinta segundos mientras hay horarios en pantalla', () => {
    verHorarios();
    const trasBuscar = busquedas;

    vi.advanceTimersByTime(SONDEO_MS);
    expect(busquedas).toBe(trasBuscar + 1);

    vi.advanceTimersByTime(SONDEO_MS);
    expect(busquedas).toBe(trasBuscar + 2);
  });

  it('no sondea con la pestaña detrás', () => {
    verHorarios();
    const trasBuscar = busquedas;

    fijarVisibilidad('hidden');
    vi.advanceTimersByTime(SONDEO_MS * 3);

    expect(busquedas).toBe(trasBuscar);
  });

  it('no sondea con el formulario a medias', () => {
    api().form.patchValue({ serviceID: '13', shiftID: '1' });
    expect(busquedas).toBe(0);

    vi.advanceTimersByTime(SONDEO_MS * 2);

    expect(busquedas).toBe(0);
  });

  // El caso real: alguien deja esto abierto, se va diez minutos y vuelve a una
  // lista que ya no describe la realidad.
  it('rebusca al volver a la pestaña, y no al dejarla', () => {
    verHorarios();
    const trasBuscar = busquedas;

    fijarVisibilidad('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(busquedas).toBe(trasBuscar);

    fijarVisibilidad('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(busquedas).toBe(trasBuscar + 1);
  });

  it('el refresco no enseña esqueleto ni suelta la franja que sigue libre', () => {
    verHorarios(true);
    expect(api().selectedScheduleId()).toBe(FRANJAS[0].id);

    vi.advanceTimersByTime(SONDEO_MS);

    // Si esto se rompe, el bloque de confirmación desaparece del DOM con el foco
    // dentro mientras el paciente escribe el motivo.
    expect(api().selectedScheduleId()).toBe(FRANJAS[0].id);
    expect(api().isLoadingSchedules()).toBe(false);
    expect(api().schedules().length).toBe(2);
  });

  it('suelta la franja elegida y avisa si otra persona la reservó', () => {
    verHorarios(true);
    respuesta = () => of([{ ...FRANJAS[0], statusID: 2 }, FRANJAS[1]]);

    vi.advanceTimersByTime(SONDEO_MS);

    expect(api().selectedScheduleId()).toBeNull();
    // No se quita en silencio: el paciente estaba a punto de confirmar esa.
    expect(TestBed.inject(NotificationService).current()?.message).toContain(
      'acaba de ser reservado',
    );
  });

  it('también la suelta si desaparece de la lista', () => {
    verHorarios(true);
    respuesta = () => of([FRANJAS[1]]);

    vi.advanceTimersByTime(SONDEO_MS);

    expect(api().selectedScheduleId()).toBeNull();
  });

  it('un sondeo que falla se ignora: ni borra la lista ni saca el error de búsqueda', () => {
    verHorarios(true);
    respuesta = () => throwError(() => ({ status: 0 }));

    vi.advanceTimersByTime(SONDEO_MS);

    expect(api().schedules().length).toBe(2);
    expect(api().selectedScheduleId()).toBe(FRANJAS[0].id);
    expect(api().schedulesError()).toBeNull();
    expect(api().isLoadingSchedules()).toBe(false);
  });

  it('no sondea mientras la cita se está confirmando', () => {
    verHorarios(true);
    // Una petición que se queda en vuelo: `isSubmitting` no vuelve a false.
    creacion = () => new Subject<ApiResponse>();
    api().confirm();
    const trasConfirmar = busquedas;

    vi.advanceTimersByTime(SONDEO_MS * 2);

    expect(busquedas).toBe(trasConfirmar);
  });

  it('al salir de la pantalla no queda ningún temporizador vivo', () => {
    verHorarios();
    const trasBuscar = busquedas;

    fixture.destroy();
    vi.advanceTimersByTime(SONDEO_MS * 5);

    expect(busquedas).toBe(trasBuscar);
  });
});
