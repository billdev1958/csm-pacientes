import { Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Convierte un contenedor de modal en un diálogo accesible.
 *
 * Los modales del proyecto eran `<div class="modal-content">`: sin role, sin
 * foco inicial, sin trampa de foco y sin Escape. Quien navegaba con teclado
 * abría un modal y el foco se quedaba en el botón que había detrás del overlay,
 * así que tabulaba por la página oculta sin verla y no tenía forma de cerrar.
 *
 * Aplicar `appDialog` resuelve las cuatro cosas. El `role` y `aria-modal` se
 * ponen aquí; `aria-labelledby` se declara en la plantilla porque el id del
 * título es propio de cada modal.
 */
@Directive({
  selector: '[appDialog]',
  host: {
    '[attr.role]': 'dialogRole()',
    'aria-modal': 'true',
    tabindex: '-1',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DialogDirective {
  /**
   * `alertdialog` para confirmaciones de acciones irreversibles; `dialog` para
   * el resto. Cambia cómo lo anuncian los lectores de pantalla.
   */
  readonly dialogRole = input<'dialog' | 'alertdialog'>('dialog');

  /** Se emite con Escape para que el anfitrión cierre como con la ✕. */
  readonly dialogClose = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Elemento que tenía el foco antes de abrir, para devolverlo al cerrar. */
  private readonly previouslyFocused = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.focusFirstElement());
  }

  ngOnDestroy(): void {
    // Al cerrar, el foco vuelve a donde estaba: si no, cae en <body> y se pierde
    // la posición en una tabla paginada.
    this.previouslyFocused?.focus?.();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dialogClose.emit();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private focusableElements(): HTMLElement[] {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null,
    );
  }

  private focusFirstElement(): void {
    const focusable = this.focusableElements();
    (focusable[0] ?? this.host.nativeElement).focus();
  }

  /** Mantiene el Tab dentro del diálogo, ciclando entre el primero y el último. */
  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === this.host.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
