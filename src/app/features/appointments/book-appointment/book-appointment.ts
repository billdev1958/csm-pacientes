import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, filter, merge, switchMap, tap } from 'rxjs';

import {
  AppointmentParams,
  AvailableSchedulesRequest,
  OfficeSchedule,
  SCHEDULE_AVAILABLE,
} from '../../../core/models/appointment.models';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ClockTimePipe } from '../../../shared/pipes/clock-time.pipe';
import { ShiftPicker, toShiftChoices } from '../shift-picker/shift-picker';
import { buildQuickDates, toDateInputValue } from './quick-dates';

/** Cuántos días se ofrecen como atajo antes de mandar al calendario. */
const QUICK_DATE_COUNT = 5;

/** El backend responde 409 cuando la franja se ocupó antes de confirmar. */
const HTTP_CONFLICT = 409;

@Component({
  selector: 'app-book-appointment',
  imports: [ReactiveFormsModule, ClockTimePipe, ShiftPicker],
  templateUrl: './book-appointment.html',
  styleUrl: './book-appointment.scss',
})
export class BookAppointment {
  private readonly fb = inject(FormBuilder);
  private readonly appointments = inject(AppointmentService);
  private readonly auth = inject(AuthService);
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
  protected readonly schedulesError = signal<string | null>(null);
  /** Ya se completó una búsqueda: distingue "sin horarios" de "aún no has elegido". */
  protected readonly hasSearched = signal(false);
  /** Cambia con cada edición del formulario para refrescar los computed derivados. */
  private readonly formVersion = signal(0);

  /** Reintento manual tras un fallo de red; alimenta la misma tubería de búsqueda. */
  private readonly retry = new Subject<void>();

  /** Bloque de confirmación, para traerlo a la vista al elegir horario. */
  private readonly confirmSection = viewChild<ElementRef<HTMLElement>>('confirmSection');

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

  /**
   * Cuántas franjas del día ya están tomadas. Se dice como una cifra en lugar de
   * pintar diez botones desactivados: al paciente le sirve saber que el día está
   * concurrido, no tocar uno por uno los que no puede reservar.
   */
  protected readonly occupiedCount = computed(
    () => this.schedules().length - this.availableSchedules().length,
  );

  /**
   * Consultorios distintos entre las franjas encontradas.
   *
   * `officeName` ya incluye el nombre del servicio ("Consultorio 3: Medicina
   * general matutino"), así que repetirlo bajo cada una de las diez franjas es
   * ruido. Normalmente hay uno solo y se muestra como contexto de la sección; si
   * llegaran varios, cada franja vuelve a decir el suyo porque entonces sí
   * distingue.
   */
  protected readonly officeNames = computed(() => [
    ...new Set(this.schedules().map((s) => s.officeName)),
  ]);

  protected readonly hasBeneficiaries = computed(
    () => (this.params()?.patients.benefeciaries ?? []).length > 0,
  );

  /** Turnos para las dos tarjetas grandes que sustituyen al desplegable. */
  protected readonly shiftOptions = computed(() => toShiftChoices(this.params()?.shifts ?? []));

  /** Franja elegida, para el resumen previo a confirmar. */
  protected readonly selectedSchedule = computed(() => {
    const id = this.selectedScheduleId();
    return id === null ? null : (this.schedules().find((s) => s.id === id) ?? null);
  });

  protected readonly selectedPatientLabel = computed(() => {
    this.formVersion();
    const chosen = this.form.controls.beneficiaryID.value;
    return this.patientOptions().find((o) => o.id === chosen)?.label ?? '';
  });

  protected readonly selectedServiceName = computed(() => {
    this.formVersion();
    const id = this.form.controls.serviceID.value;
    return (this.params()?.services ?? []).find((s) => String(s.id) === id)?.name ?? '';
  });

  protected readonly selectedDate = computed(() => {
    this.formVersion();
    return this.form.controls.appointmentDate.value;
  });

  /** Marca visualmente la tarjeta de turno elegida; el radio ya lleva el estado. */
  protected readonly selectedShift = computed(() => {
    this.formVersion();
    return this.form.controls.shiftID.value;
  });

  /** Fecha elegida en palabras, que se lee mejor que 2026-08-15. */
  protected readonly selectedDateLabel = computed(() => {
    const value = this.selectedDate();
    if (!value) {
      return '';
    }
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  });

  /**
   * En qué paso está el paciente. Antes el paso 1 llevaba `--done` y
   * `aria-current="step"` fijos en la plantilla, así que el indicador decía
   * siempre lo mismo pasara lo que pasara.
   */
  protected readonly currentStep = computed(() => {
    if (this.selectedScheduleId() !== null) {
      return 3;
    }
    return this.schedules().length > 0 ? 2 : 1;
  });

  protected readonly steps = [
    { number: 1, title: 'Servicio y fecha' },
    { number: 2, title: 'Horario' },
    { number: 3, title: 'Confirmar' },
  ] as const;

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
  protected readonly today = toDateInputValue(new Date());

  /** Atajos para los días próximos; el calendario cubre el resto. */
  protected readonly quickDates = buildQuickDates(new Date(), QUICK_DATE_COUNT);

  constructor() {
    this.loadParams();

    // Los computed del resumen leen controles del formulario, que no son signals:
    // este signal se actualiza en cada cambio y los vuelve a disparar.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formVersion.update((v) => v + 1));

    // Servicio, turno y fecha son lo único que define qué franjas existen, así
    // que en cuanto la combinación está completa se buscan solas: pedir además
    // un botón "Ver horarios disponibles" era un paso de más sin información
    // nueva que aportar.
    //
    // Se escuchan SOLO esos tres controles, no el formulario entero. Escuchar
    // `form.valueChanges` borraba la selección al teclear en "motivo" o
    // "síntomas", que viven en el mismo grupo: el bloque de confirmación
    // desaparecía del DOM con el foco dentro y no se podía escribir.
    //
    // `beneficiaryID` tampoco entra: cambia para quién es la cita, no qué franjas
    // existen.
    const criteriaChanged = merge(
      this.form.controls.serviceID.valueChanges,
      this.form.controls.shiftID.valueChanges,
      this.form.controls.appointmentDate.valueChanges,
    ).pipe(tap(() => this.discardSchedules()));

    merge(criteriaChanged, this.retry)
      .pipe(
        filter(() => this.criteria() !== null),
        // `switchMap` cancela la búsqueda anterior: si alguien cambia de fecha
        // dos veces seguidas, la respuesta lenta de la primera ya no puede pisar
        // a la de la segunda.
        switchMap(() => this.fetchSchedules()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((schedules) => {
        this.isLoadingSchedules.set(false);
        this.hasSearched.set(true);
        this.schedules.set(schedules);
      });

    // Al elegir un horario, el bloque de confirmación aparece más abajo; en
    // teléfono cae fuera de la pantalla y parece que no ocurrió nada. No se
    // mueve el foco a propósito: el paciente puede seguir comparando horarios y
    // arrancárselo le quitaría el sitio donde estaba. El cambio se anuncia por la
    // región viva de la plantilla.
    effect(() => {
      if (this.selectedScheduleId() === null) {
        return;
      }
      const section = this.confirmSection()?.nativeElement;
      section?.scrollIntoView?.({ behavior: this.scrollBehavior(), block: 'start' });
    });
  }

  /** Respeta a quien pidió menos animación en su sistema operativo. */
  private scrollBehavior(): ScrollBehavior {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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
          // Única fuente del nombre del titular en todo el cliente: el login no
          // lo devuelve. Se guarda aquí para que la barra superior pueda decir
          // quién está identificado sin añadir ninguna petición.
          this.auth.rememberDisplayName(params.patients.fullName);
        },
        error: () => {
          this.isLoadingParams.set(false);
          this.loadError.set('No se pudieron cargar los datos para agendar.');
        },
      });
  }

  /**
   * La combinación de búsqueda si está completa, o null.
   *
   * Lee `getRawValue()` y no el computed derivado porque corre dentro de la
   * tubería, antes de que `formVersion` se haya actualizado.
   */
  private criteria(): AvailableSchedulesRequest | null {
    const { serviceID, shiftID, appointmentDate } = this.form.getRawValue();
    if (!serviceID || !shiftID || !appointmentDate) {
      return null;
    }
    return {
      service: Number(serviceID),
      shift: Number(shiftID),
      // El backend parsea con time.RFC3339, así que la fecha del input
      // (YYYY-MM-DD) necesita hora y zona.
      appointmentDate: new Date(`${appointmentDate}T00:00:00`).toISOString(),
    };
  }

  /**
   * Descarta lo cargado: dejar las franjas en pantalla tras cambiar el servicio,
   * el turno o la fecha permitiría reservar una franja de otra combinación.
   */
  private discardSchedules(): void {
    this.schedules.set([]);
    this.selectedScheduleId.set(null);
    this.schedulesError.set(null);
    this.hasSearched.set(false);
  }

  private fetchSchedules(): Observable<OfficeSchedule[]> {
    const criteria = this.criteria();
    if (!criteria) {
      return EMPTY;
    }

    this.isLoadingSchedules.set(true);
    this.schedulesError.set(null);

    return this.appointments.getAvailableSchedules(criteria).pipe(
      catchError(() => {
        this.isLoadingSchedules.set(false);
        // Se corta esta petición, no la tubería: tiene que seguir viva para el
        // siguiente cambio de fecha y para el botón de reintentar.
        this.schedulesError.set('No se pudieron cargar los horarios de ese día.');
        return EMPTY;
      }),
    );
  }

  /** Reintenta la búsqueda tras un fallo, sin tocar lo que el paciente ya eligió. */
  protected retrySearch(): void {
    this.retry.next();
  }

  protected chooseDate(value: string): void {
    this.form.controls.appointmentDate.setValue(value);
  }

  /** El selector de turno es un hijo presentacional: escribe aquí su elección. */
  protected chooseShift(value: string): void {
    this.form.controls.shiftID.setValue(value);
  }

  protected selectSchedule(schedule: OfficeSchedule): void {
    this.selectedScheduleId.set(schedule.id);
  }

  protected confirm(): void {
    const selected = this.selectedSchedule();
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
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.isSubmitting.set(false);
          this.notifications.show(err.error?.message ?? 'No se pudo agendar la cita.', 'error');

          // 409: otra persona reservó esa franja entre que se cargó la lista y se
          // pulsó confirmar. La lista en pantalla ya está desactualizada, así que
          // se vuelve a buscar; si no, el paciente ve libre lo que no lo está y
          // reintenta lo mismo una y otra vez.
          if (err.status === HTTP_CONFLICT) {
            this.selectedScheduleId.set(null);
            this.retry.next();
          }
        },
      });
  }

  /** Une la fecha elegida con la hora de la franja (HH:mm:ss) en ISO 8601. */
  private combine(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }
}
