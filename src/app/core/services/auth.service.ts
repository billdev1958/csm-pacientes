import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { LoginRequest, LoginResponseData, RegisterPatientRequest } from '../models/auth.models';
import { Role } from '../../shared/constants/roles';

const TOKEN_KEY = 'csm_paciente_token';
const USER_KEY = 'csm_paciente_user';

/**
 * Datos de sesión que se persisten. El token va aparte.
 *
 * `displayName` no viene del login —`LoginResponseData` no trae el nombre— sino
 * de la primera pantalla que lo recibe del backend. Se guarda con la sesión para
 * que sobreviva a una recarga.
 */
type StoredUser = Omit<LoginResponseData, 'token'> & { displayName?: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUser = signal<StoredUser | null>(this.hydrate());

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly accountId = computed(() => this.currentUser()?.accountID ?? null);
  /**
   * Este portal es solo para pacientes. Se expone para que la interfaz pueda
   * avisar si alguien del personal entra aquí por error: su token es válido, pero
   * las pantallas están pensadas para el rol paciente.
   */
  readonly isPatient = computed(() => this.currentUser()?.role === Role.Patient);

  /**
   * Nombre del titular de la cuenta, o null mientras no se conozca.
   *
   * El backend no lo devuelve al identificarse: `POST /v1/login` responde
   * accountID, role, token e isActive y nada más. La única fuente en el cliente
   * es `GET /v1/appointment/schedules`, que la pantalla de agendar ya pide para
   * armar su formulario, así que la barra superior lo muestra en cuanto se ha
   * pasado por ahí una vez y desde ahí en adelante, incluso tras recargar.
   */
  readonly displayName = computed(() => this.currentUser()?.displayName ?? null);

  /**
   * Guarda el nombre del titular cuando una pantalla lo recibe del backend.
   *
   * No añade ninguna petición: se alimenta de una respuesta que ya se pedía. Sin
   * sesión activa no hace nada, y si el nombre no cambió tampoco reescribe, para
   * no tocar `localStorage` en cada visita.
   */
  rememberDisplayName(fullName: string): void {
    const user = this.currentUser();
    if (!user || !fullName || user.displayName === fullName) {
      return;
    }
    const updated: StoredUser = { ...user, displayName: fullName };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponseData>> {
    return this.http
      .post<ApiResponse<LoginResponseData>>(`${environment.apiUrl}/login`, credentials)
      .pipe(
        tap((response) => {
          if (response.status === 'success' && response.data?.token) {
            this.startSession(response.data);
          }
        }),
      );
  }

  /** Registro público de paciente (`POST /v1/patients`). No inicia sesión. */
  register(request: RegisterPatientRequest): Observable<ApiResponse> {
    // El backend espera el teléfono en la clave `phone`, no `phoneNumber`.
    const { phoneNumber, ...rest } = request;
    return this.http.post<ApiResponse>(`${environment.apiUrl}/patients`, {
      ...rest,
      phone: phoneNumber,
    });
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  private startSession(data: LoginResponseData): void {
    const { token, ...user } = data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /**
   * Restaura la sesión al recargar. Si el token o los datos no están, o están
   * corruptos, se descarta todo: una sesión a medias es peor que ninguna.
   */
  private hydrate(): StoredUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
