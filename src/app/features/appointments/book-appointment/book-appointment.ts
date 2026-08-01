import {
  Component,
  DOCUMENT,
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
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  filter,
  fromEvent,
  interval,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';

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

/**
 * Cada cuánto se vuelve a preguntar por las franjas mientras están en pantalla.
 *
 * Treinta segundos es el compromiso: suficiente para que una franja que otra
 * persona acaba de tomar desaparezca antes de que la pulses, y poco tráfico
 * —dos peticiones por minuto y solo con la pestaña delante—.
 */
const REFRESH_INTERVAL_MS = 30_000;

/**
 * Quién pidió una búsqueda.
 *
 * No es lo mismo: la que pide el paciente enseña esqueleto y puede enseñar un
 * error; la de segundo plano no puede hacer ninguna de las dos cosas.
 */
type SearchTrigger = 'requested' | 'refreshed';

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
  private readonly document = inject(DOCUMENT);

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

    // Lo que pide el paciente: cambiar la combinación o pulsar reintentar.
    const requested = merge(criteriaChanged, this.retry).pipe(
      filter(() => this.criteria() !== null),
      map((): SearchTrigger => 'requested'),
    );

    // Lo que no pide nadie. Dos disparadores:
    //
    //   - Volver a la pestaña, que es el caso real: alguien deja esto abierto,
    //     se va diez minutos y vuelve a una lista que ya no describe la realidad.
    //   - Un sondeo cada treinta segundos mientras mira los horarios.
    //
    // `canRefresh` es lo que impide que esto moleste: no corre con la pestaña
    // detrás, ni con el formulario a medias, ni mientras hay algo en vuelo.
    const refreshed = merge(
      fromEvent(this.document, 'visibilitychange'),
      interval(REFRESH_INTERVAL_MS),
    ).pipe(
      filter(() => this.canRefresh()),
      map((): SearchTrigger => 'refreshed'),
    );

    // Una sola tubería, un solo `switchMap`: nunca hay más de una petición viva
    // y siempre gana la última que entró. Por eso una búsqueda del paciente
    // cancela el sondeo que estuviera en vuelo, y lo contrario no puede pasar,
    // porque `canRefresh` no deja arrancar un sondeo mientras algo se carga.
    merge(requested, refreshed)
      .pipe(
        switchMap((trigger) =>
          (trigger === 'requested' ? this.fetchSchedules() : this.fetchSchedulesQuietly()).pipe(
            map((schedules) => ({ trigger, schedules })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ trigger, schedules }) => {
        if (trigger === 'requested') {
          this.applyRequestedSearch(schedules);
          return;
        }
        this.applyRefresh(schedules);
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

  /**
   * Lo mismo, pero sin tocar nada de lo que se ve.
   *
   * Ni esqueleto de carga ni mensaje de error: un sondeo que falla —se cayó la
   * red, el servidor no contesta— se descarta y la lista se queda como estaba.
   * El paciente no pidió nada, así que no tiene por qué enterarse; la petición
   * va marcada como silenciosa para que tampoco salte la notificación global.
   */
  private fetchSchedulesQuietly(): Observable<OfficeSchedule[]> {
    const criteria = this.criteria();
    if (!criteria) {
      return EMPTY;
    }

    return this.appointments
      .getAvailableSchedules(criteria, { silentErrors: true })
      .pipe(catchError(() => EMPTY));
  }

  /**
   * Si toca volver a preguntar por las franjas por cuenta propia.
   *
   * Todas las condiciones son para no estorbar: con la pestaña detrás no hay
   * nadie mirando; con el formulario a medias no hay nada que refrescar; con una
   * lista vacía tampoco; y si hay una búsqueda cargando, un envío en curso o un
   * error en pantalla, el paciente ya está en medio de algo.
   */
  private canRefresh(): boolean {
    return (
      this.document.visibilityState === 'visible' &&
      this.criteria() !== null &&
      this.schedules().length > 0 &&
      !this.isLoadingSchedules() &&
      !this.isSubmitting() &&
      this.schedulesError() === null
    );
  }

  private applyRequestedSearch(schedules: OfficeSchedule[]): void {
    this.isLoadingSchedules.set(false);
    this.hasSearched.set(true);
    this.schedules.set(schedules);
  }

  /**
   * Mete el resultado de un refresco sin pisar al paciente.
   *
   * La lista se sustituye en silencio —un esqueleto parpadeando cada treinta
   * segundos dejaría la pantalla inservible— y la franja elegida sigue elegida
   * mientras siga libre, para que el bloque de confirmación no desaparezca del
   * DOM con el foco dentro mientras se escribe el motivo.
   */
  private applyRefresh(schedules: OfficeSchedule[]): void {
    const chosenId = this.selectedScheduleId();
    this.schedules.set(schedules);

    if (chosenId === null || this.isStillAvailable(schedules, chosenId)) {
      return;
    }

    // Se suelta, pero no en silencio: el paciente estaba a punto de confirmar
    // justo esa, y que se esfumara sin explicación sería peor que el aviso.
    this.selectedScheduleId.set(null);
    this.notifications.show(
      'El horario que habías elegido acaba de ser reservado. Elige otro.',
      'error',
    );
  }

  /** Sigue en la lista Y sigue libre: que vuelva marcada como ocupada no vale. */
  private isStillAvailable(schedules: readonly OfficeSchedule[], id: number): boolean {
    return schedules.some(
      (schedule) => schedule.id === id && schedule.statusID === SCHEDULE_AVAILABLE,
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
