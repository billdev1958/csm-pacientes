import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { DialogDirective } from '../../../shared/directives/dialog.directive';
import { AppointmentCard } from '../appointment-card/appointment-card';
import { appointmentCountLabel, groupAppointments } from '../appointment-grouping';

import { Appointment, AppointmentStatus } from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Estados que el backend acepta cancelar. Es una lista de permitidos y no de
 * prohibidos a propósito: si el estado llega ausente o con un id que este código
 * no conoce, se oculta el botón en lugar de ofrecer una acción que el servidor va
 * a rechazar. La regla espeja la validación de `CancelAppointment`, que rechaza
 * iniciada, concluida y cancelada.
 */
const CANCELLABLE_STATUSES: readonly number[] = [
  AppointmentStatus.Pendiente,
  AppointmentStatus.Confirmada,
];

@Component({
  selector: 'app-my-appointments',
  imports: [DatePipe, RouterLink, DialogDirective, AppointmentCard],
  templateUrl: './my-appointments.html',
  styleUrl: './my-appointments.scss',
})
export class MyAppointments {
  private readonly appointments = inject(AppointmentService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly list = signal<Appointment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly cancellingId = signal<string | null>(null);
  /** Cita cuya cancelación se está confirmando. */
  protected readonly pendingCancel = signal<Appointment | null>(null);

  /**
   * Instante contra el que se decide qué es próximo y cuánto falta. Se fija al
   * cargar en lugar de leer el reloj dentro del `computed`: así la agrupación no
   * cambia sola a mitad de una interacción, y se vuelve a calcular en cada
   * recarga, que es cuando los datos pueden haber cambiado de todas formas.
   */
  private readonly now = signal(new Date());

  private readonly grouped = computed(() => groupAppointments(this.list(), this.now()));

  /** Las que todavía pueden ocurrir, de la más cercana a la más lejana. */
  protected readonly upcoming = computed(() => this.grouped().upcoming);

  /** Concluidas, canceladas y pasadas, de la más reciente a la más antigua. */
  protected readonly history = computed(() => this.grouped().history);

  /** Insignias de conteo junto al título de cada grupo. */
  protected readonly upcomingCount = computed(() => appointmentCountLabel(this.upcoming().length));
  protected readonly historyCount = computed(() => appointmentCountLabel(this.history().length));

  protected readonly hasAppointments = computed(() => this.list().length > 0);

  constructor() {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    // Sin filtros: el backend acota el resultado a la cuenta del token, así que
    // esto nunca devuelve citas de otra persona.
    this.appointments
      .getMyAppointments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointments) => {
          this.isLoading.set(false);
          this.now.set(new Date());
          this.list.set(appointments);
        },
        error: () => {
          this.isLoading.set(false);
          // Distinguir el fallo del resultado vacío: si no, un servidor caído se
          // lee como "no tienes citas".
          this.loadError.set('No se pudieron cargar tus citas.');
        },
      });
  }

  /** Permite reintentar sin recargar la página cuando la carga falla. */
  protected reload(): void {
    this.load();
  }

  /**
   * Traduce el estado de la cita al modificador de la insignia. Se mapea por id y
   * no por el nombre que llega del backend, que es texto libre de la base.
   */
  protected statusModifier(appointment: Appointment): string {
    switch (appointment.statusID) {
      case AppointmentStatus.Confirmada:
      // Una cita en curso ya no está a la espera: comparte el estilo activo.
      case AppointmentStatus.Iniciada:
        return 'confirmed';
      case AppointmentStatus.Concluida:
        return 'done';
      case AppointmentStatus.Cancelada:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  protected canCancel(appointment: Appointment): boolean {
    // El campo es opcional en el contrato, así que un `undefined` cae fuera de la
    // lista y oculta el botón, que es el lado seguro.
    return (
      appointment.statusID !== undefined && CANCELLABLE_STATUSES.includes(appointment.statusID)
    );
  }

  protected askCancel(appointment: Appointment): void {
    this.pendingCancel.set(appointment);
  }

  protected dismissCancel(): void {
    this.pendingCancel.set(null);
  }

  protected confirmCancel(): void {
    const appointment = this.pendingCancel();
    if (!appointment) {
      return;
    }

    this.cancellingId.set(appointment.appointmentID);

    this.appointments
      .cancelAppointment(appointment.appointmentID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.cancellingId.set(null);
          this.pendingCancel.set(null);
          if (response.status === 'success') {
            this.notifications.show('Tu cita fue cancelada.', 'success');
            this.load();
            return;
          }
          this.notifications.show(response.message ?? 'No se pudo cancelar la cita.', 'error');
        },
        error: (err: { error?: { message?: string } }) => {
          this.cancellingId.set(null);
          this.pendingCancel.set(null);
          this.notifications.show(err.error?.message ?? 'No se pudo cancelar la cita.', 'error');
        },
      });
  }
}
