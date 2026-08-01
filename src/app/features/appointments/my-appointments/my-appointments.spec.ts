import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Appointment } from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { MyAppointments } from './my-appointments';

/** Cita mínima con el estado indicado; el resto de los campos no influye aquí. */
function cita(statusID: number | undefined, statusName: string): Appointment {
  return {
    appointmentID: `0000000${statusID ?? 0}-0000-0000-0000-000000000000`,
    officeScheduleID: 1,
    doctorID: '11111111-1111-1111-1111-111111111111',
    doctorName: 'Dra. Demo Doctora',
    accountID: '22222222-2222-2222-2222-222222222222',
    patientID: '22222222-2222-2222-2222-222222222222',
    beneficiaryID: undefined,
    fullName: 'Prueba Portal Pacientes',
    medicalHistoryID: 'MH-1',
    serviceID: 13,
    shiftID: 1,
    officeName: 'Consultorio 3',
    serviceName: 'Medicina general matutino',
    timeStart: '2026-08-03T08:00:00Z',
    timeEnd: '2026-08-03T08:30:00Z',
    statusID,
    statusName,
    symptoms: undefined,
    reason: undefined,
  };
}

const CITAS = [
  cita(1, 'Pendiente'),
  cita(2, 'Confirmada'),
  cita(3, 'Iniciada'),
  cita(4, 'Concluida'),
  cita(5, 'Cancelada'),
];

describe('MyAppointments', () => {
  let fixture: ComponentFixture<MyAppointments>;
  let component: MyAppointments;

  beforeEach(async () => {
    const servicio = {
      getMyAppointments: () => of(CITAS),
      cancelAppointment: () => of({ status: 'success' as const }),
    };

    await TestBed.configureTestingModule({
      imports: [MyAppointments],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AppointmentService, useValue: servicio },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyAppointments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Accede a los miembros protegidos que la plantilla usa. */
  function api() {
    return component as unknown as {
      canCancel: (a: Appointment) => boolean;
      statusModifier: (a: Appointment) => string;
      list: () => Appointment[];
    };
  }

  it('carga las citas de la cuenta', () => {
    expect(api().list().length).toBe(5);
  });

  // El caso que reportó el usuario: tras cancelar, el botón "Cancelar cita"
  // seguía apareciendo. La causa estaba en el backend, que devolvía statusID 0
  // porque ni la consulta ni el mapeo a DTO incluían la columna status_id.
  it('no ofrece cancelar una cita ya cancelada', () => {
    expect(api().canCancel(cita(5, 'Cancelada'))).toBe(false);
  });

  it('no ofrece cancelar una cita concluida', () => {
    expect(api().canCancel(cita(4, 'Concluida'))).toBe(false);
  });

  // El backend rechaza cancelar una cita iniciada (estado 3), así que ofrecer el
  // botón solo produciría un error del servidor.
  it('no ofrece cancelar una cita ya iniciada', () => {
    expect(api().canCancel(cita(3, 'Iniciada'))).toBe(false);
  });

  it('sí ofrece cancelar mientras está pendiente o confirmada', () => {
    expect(api().canCancel(cita(1, 'Pendiente'))).toBe(true);
    expect(api().canCancel(cita(2, 'Confirmada'))).toBe(true);
  });

  // Lista de permitidos: un estado ausente o desconocido oculta el botón en vez
  // de ofrecer una acción que va a fallar.
  it('oculta el botón si el estado llega ausente o desconocido', () => {
    expect(api().canCancel(cita(undefined, ''))).toBe(false);
    // 0 era exactamente lo que devolvía el backend con el defecto original.
    expect(api().canCancel(cita(0, ''))).toBe(false);
    expect(api().canCancel(cita(99, 'Estado nuevo'))).toBe(false);
  });

  it('asigna a cada estado su insignia', () => {
    const modificador = (id: number) => api().statusModifier(cita(id, ''));
    expect(modificador(1)).toBe('pending');
    expect(modificador(2)).toBe('confirmed');
    expect(modificador(3)).toBe('confirmed');
    expect(modificador(4)).toBe('done');
    expect(modificador(5)).toBe('cancelled');
  });
});
