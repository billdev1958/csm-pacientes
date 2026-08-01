import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  AppointmentParams,
  OfficeSchedule,
  SCHEDULE_AVAILABLE,
} from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-book-appointment',
  imports: [ReactiveFormsModule],
  templateUrl: './book-appointment.html',
  styleUrl: './book-appointment.scss',
})
export class BookAppointment {
  private readonly fb = inject(FormBuilder);
  private readonly appointments = inject(AppointmentService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly params = signal<AppointmentParams | null>(null);
  protected readonly schedules = signal<OfficeSchedule[]>([]);
  protected readonly selectedScheduleId = signal<number | null>(null);

  protected readonly isLoadingParams = signal(true);
  protected readonly isLoadingSchedules = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly loadError = signal<string | null>(null);

  /** Titular más beneficiarios: para quién se puede agendar. */
  protected readonly patientOptions = computed(() => {
    const params = this.params();
    if (!params) {
      return [];
    }
    return [
      { id: '', label: `${params.patients.fullName} (titular)` },
      ...(params.patients.benefeciaries ?? []).map((b) => ({
        id: b.beneficiaryID,
        label: b.fullName,
      })),
    ];
  });

  protected readonly availableSchedules = computed(() =>
    this.schedules().filter((s) => s.statusID === SCHEDULE_AVAILABLE),
  );

  protected readonly form = this.fb.nonNullable.group({
    /** Cadena vacía significa "para el titular". */
    beneficiaryID: [''],
    serviceID: ['', [Validators.required]],
    shiftID: ['', [Validators.required]],
    appointmentDate: ['', [Validators.required]],
    reason: [''],
    symptoms: [''],
  });

  /** Hoy en formato YYYY-MM-DD, para no permitir fechas pasadas en el calendario. */
  protected readonly today = new Date().toISOString().slice(0, 10);

  constructor() {
    this.loadParams();

    // Cambiar servicio, turno o fecha invalida las franjas ya cargadas: dejarlas
    // en pantalla haría que se reservara una franja de otra combinación.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.schedules().length > 0) {
        this.schedules.set([]);
        this.selectedScheduleId.set(null);
      }
    });
  }

  private loadParams(): void {
    this.appointments
      .getParams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (params) => {
          this.isLoadingParams.set(false);
          if (!params) {
            this.loadError.set('No se pudieron cargar los datos para agendar.');
            return;
          }
          this.params.set(params);
        },
        error: () => {
          this.isLoadingParams.set(false);
          this.loadError.set('No se pudieron cargar los datos para agendar.');
        },
      });
  }

  protected searchSchedules(): void {
    const { serviceID, shiftID, appointmentDate } = this.form.getRawValue();
    if (!serviceID || !shiftID || !appointmentDate) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoadingSchedules.set(true);
    this.selectedScheduleId.set(null);

    this.appointments
      .getAvailableSchedules({
        service: Number(serviceID),
        shift: Number(shiftID),
        // El backend parsea con time.RFC3339, así que la fecha del input
        // (YYYY-MM-DD) necesita hora y zona.
        appointmentDate: new Date(`${appointmentDate}T00:00:00`).toISOString(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schedules) => {
          this.isLoadingSchedules.set(false);
          this.schedules.set(schedules);
          if (schedules.length === 0) {
            this.notifications.show('No hay horarios para ese día y turno.', 'info');
          }
        },
        error: () => this.isLoadingSchedules.set(false),
      });
  }

  protected selectSchedule(schedule: OfficeSchedule): void {
    this.selectedScheduleId.set(schedule.id);
  }

  protected confirm(): void {
    const scheduleId = this.selectedScheduleId();
    const selected = this.schedules().find((s) => s.id === scheduleId);
    const params = this.params();
    if (!selected || !params) {
      return;
    }

    const { beneficiaryID, appointmentDate, reason, symptoms } = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.appointments
      .createAppointment({
        scheduleID: selected.id,
        // El backend ignora este campo para un paciente y usa el del token; se
        // envía porque el DTO lo declara.
        accountHolderID: params.patients.accountHolderID,
        beneficiaryID: beneficiaryID || null,
        timeStart: this.combine(appointmentDate, selected.timeStart),
        timeEnd: this.combine(appointmentDate, selected.timeEnd),
        reason,
        symptoms,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          if (response.status === 'success') {
            this.notifications.show('Tu cita quedó agendada.', 'success');
            void this.router.navigate(['/mis-citas']);
            return;
          }
          this.notifications.show(response.message ?? 'No se pudo agendar la cita.', 'error');
        },
        error: (err: { error?: { message?: string } }) => {
          this.isSubmitting.set(false);
          this.notifications.show(err.error?.message ?? 'No se pudo agendar la cita.', 'error');
        },
      });
  }

  /** Une la fecha elegida con la hora de la franja (HH:mm:ss) en ISO 8601. */
  private combine(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }
}
