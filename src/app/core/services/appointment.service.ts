import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../interceptors/error.interceptor';
import { ApiResponse } from '../models/api.models';
import {
  Appointment,
  AppointmentParams,
  AvailableSchedulesRequest,
  CancelAppointmentRequest,
  CreateAppointmentRequest,
  OfficeSchedule,
  SearchAppointmentsRequest,
} from '../models/appointment.models';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Titular, beneficiarios, servicios y turnos para armar el formulario.
   *
   * El backend resuelve la cuenta con el token, así que no recibe parámetros.
   */
  getParams(): Observable<AppointmentParams | null> {
    return this.http
      .get<ApiResponse<AppointmentParams>>(`${this.baseUrl}/appointment/schedules`)
      .pipe(map((response) => response.data ?? null));
  }

  /**
   * Franjas de un día para un servicio y turno.
   *
   * Devuelve todas, no solo las libres: cada una trae `statusID` (1 disponible,
   * 2 ocupada, 3 bloqueada), y quien la llama decide qué hacer con las que no se
   * pueden reservar.
   *
   * `silentErrors` marca las peticiones que el paciente no pidió —el refresco de
   * horarios en segundo plano— para que un fallo suyo no saque una notificación
   * global cada treinta segundos.
   */
  getAvailableSchedules(
    request: AvailableSchedulesRequest,
    options: { silentErrors?: boolean } = {},
  ): Observable<OfficeSchedule[]> {
    const context = new HttpContext().set(SILENT_HTTP_ERRORS, options.silentErrors ?? false);
    return this.http
      .post<ApiResponse<OfficeSchedule[]>>(`${this.baseUrl}/appointment/schedules`, request, {
        context,
      })
      .pipe(map((response) => response.data ?? []));
  }

  createAppointment(request: CreateAppointmentRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/appointment`, request);
  }

  /**
   * Citas de la cuenta.
   *
   * El backend acota el resultado a la cuenta del token cuando quien pregunta es
   * un paciente, así que este método nunca devuelve citas de otras personas
   * aunque no se envíe ningún filtro.
   */
  getMyAppointments(filters: SearchAppointmentsRequest = {}): Observable<Appointment[]> {
    return this.http
      .post<ApiResponse<Appointment[]>>(`${this.baseUrl}/appointments`, filters)
      .pipe(map((response) => response.data ?? []));
  }

  cancelAppointment(appointmentId: string): Observable<ApiResponse> {
    const body: CancelAppointmentRequest = { appointmentId };
    return this.http.post<ApiResponse>(`${this.baseUrl}/admin/appointment/cancel`, body);
  }
}
