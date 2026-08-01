/**
 * Modelos del flujo de agendado.
 *
 * Los nombres de campo se tomaron de las etiquetas `json` de los DTO de Go, no
 * de lo que parecería natural en TypeScript. Dos rarezas verificadas contra el
 * backend que hay que respetar:
 *
 *   - El teléfono del paciente viaja como `phone`, no `phoneNumber`.
 *   - La lista de beneficiarios viaja como `benefeciaries`, con la errata que
 *     tiene el backend. Corregirla aquí rompería la deserialización.
 */

/** Beneficiario asociado a la cuenta del paciente titular. */
export interface Beneficiary {
  beneficiaryID: string;
  fullName: string;
}

/** Titular y sus beneficiarios: para quién se puede agendar. */
export interface PatientAndBeneficiaries {
  accountHolderID: string;
  fullName: string;
  /** Errata del backend: `benefeciaries`. Puede llegar null si no tiene. */
  benefeciaries: Beneficiary[] | null;
}

export interface ServiceOption {
  id: number;
  name: string;
}

export interface ShiftOption {
  id: number;
  name: string;
}

/**
 * `data` de `GET /v1/appointment/schedules`: todo lo necesario para armar el
 * formulario de agendado. El backend lo resuelve con el accountID del token, así
 * que no hay que enviarle nada.
 */
export interface AppointmentParams {
  patients: PatientAndBeneficiaries;
  services: ServiceOption[] | null;
  shifts: ShiftOption[] | null;
}

/** Cuerpo de `POST /v1/appointment/schedules`. */
export interface AvailableSchedulesRequest {
  service: number;
  shift: number;
  /** ISO 8601 completo; el backend lo parsea con time.RFC3339. */
  appointmentDate: string;
}

/**
 * Franja horaria devuelta por el backend.
 *
 * `statusID` viene del CASE de la consulta: 1 disponible, 2 ocupado,
 * 3 bloqueado. Solo el 1 se puede reservar.
 */
export interface OfficeSchedule {
  id: number;
  timeStart: string;
  timeEnd: string;
  timeDuration: string;
  officeName: string;
  statusID: number;
  shiftID: number;
}

export const SCHEDULE_AVAILABLE = 1;

/**
 * Cuerpo de `POST /v1/appointment`.
 *
 * `accountHolderID` se envía porque el DTO lo declara, pero el backend lo ignora
 * para un paciente y usa el del token: aceptarlo del cuerpo permitía agendar en
 * la cuenta de otra persona.
 *
 * `beneficiaryID` es un uuid.NullUUID en Go: se envía como string cuando la cita
 * es para un beneficiario, y se omite o va null cuando es para el titular.
 */
export interface CreateAppointmentRequest {
  scheduleID: number;
  accountHolderID: string;
  beneficiaryID?: string | null;
  timeStart: string;
  timeEnd: string;
  reason?: string;
  symptoms?: string;
}

/** Cuerpo de `POST /v1/appointments`. Un paciente solo recibe las de su cuenta. */
export interface SearchAppointmentsRequest {
  fullName?: string;
  medicalHistoryID?: string;
  /** Formato YYYY-MM-DD. */
  date?: string;
}

export interface Appointment {
  appointmentID: string;
  officeScheduleID: number;
  doctorID: string;
  doctorName: string;
  accountID: string;
  patientID: string;
  beneficiaryID?: string | null;
  fullName: string;
  medicalHistoryID: string;
  serviceID: number;
  shiftID: number;
  officeName: string;
  serviceName: string;
  timeStart: string;
  timeEnd?: string;
  statusID?: number;
  statusName?: string;
  reason?: string;
  symptoms?: string;
}

/**
 * Cuerpo de `POST /v1/admin/appointment/cancel`.
 *
 * La clave es `appointmentId` con d minúscula, distinto del `appointmentID` que
 * usa el resto de la API. Escribirla como las demás hace que el backend reciba un
 * UUID nulo y responda "el ID de la cita no puede ser nulo".
 */
export interface CancelAppointmentRequest {
  appointmentId: string;
}
