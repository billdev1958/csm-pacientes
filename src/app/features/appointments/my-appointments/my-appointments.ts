import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Appointment } from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Estados de appointment_status. Cancelada y concluida ya no se pueden cancelar. */
const STATUS_CANCELADA = 5;
const STATUS_CONCLUIDA = 4;

@Component({
  selector: 'app-my-appointments',
  imports: [DatePipe, RouterLink],
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

  protected canCancel(appointment: Appointment): boolean {
    const status = appointment.statusID;
    return status !== STATUS_CANCELADA && status !== STATUS_CONCLUIDA;
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
