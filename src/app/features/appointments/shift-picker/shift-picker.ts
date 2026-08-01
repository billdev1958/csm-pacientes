import { Component, input, output } from '@angular/core';

import { ShiftOption } from '../../../core/models/appointment.models';

/** Icono de la tarjeta de turno. La plantilla lo resuelve con `@switch`. */
export type ShiftIcon = 'morning' | 'afternoon' | 'none';

/** Un turno tal y como lo pinta esta tarjeta. */
export interface ShiftChoice {
  /**
   * Cadena, no número: el control del formulario que hay detrás guarda texto,
   * igual que cuando esto era un `<select>`.
   */
  id: string;
  name: string;
  icon: ShiftIcon;
}

/**
 * Icono por id de turno, no por nombre: los ids de la tabla son estables y el
 * nombre es texto libre de la base.
 */
const SHIFT_ICONS: Readonly<Record<number, ShiftIcon>> = {
  1: 'morning',
  2: 'afternoon',
};

/**
 * Traduce los turnos del backend a lo que pinta la tarjeta.
 *
 * La lista sale siempre de la respuesta, nunca de constantes escritas a mano: si
 * el backend añade un turno, aparece solo. Uno cuyo id no se reconozca se pinta
 * sin icono, que es preferible a dejarlo fuera y que el paciente no pueda
 * elegirlo.
 */
export function toShiftChoices(shifts: readonly ShiftOption[]): ShiftChoice[] {
  return shifts.map((shift) => ({
    id: String(shift.id),
    name: shift.name,
    icon: SHIFT_ICONS[shift.id] ?? 'none',
  }));
}

/**
 * Turno como dos tarjetas grandes en lugar de un desplegable.
 *
 * Son dos opciones y solo dos, así que un `<select>` obligaba a abrir, leer y
 * elegir donde bastan dos objetivos de 96 px. Por dentro siguen siendo radios de
 * verdad dentro de un `fieldset` con su `legend`, así que el teclado y el lector
 * de pantalla los recorren como el grupo que son; lo único oculto es el círculo
 * del radio, que la tarjeta sustituye.
 *
 * No usa `formControlName`: un control reactivo no se resuelve dentro de la
 * plantilla de un hijo. El anfitrión ata el valor con `selected` y escribe en su
 * formulario al recibir `selectedChange`.
 */
@Component({
  selector: 'app-shift-picker',
  templateUrl: './shift-picker.html',
  styleUrl: './shift-picker.scss',
})
export class ShiftPicker {
  readonly options = input.required<ShiftChoice[]>();

  /** Id del turno elegido, o cadena vacía si todavía no hay ninguno. */
  readonly selected = input('');

  readonly selectedChange = output<string>();
}
