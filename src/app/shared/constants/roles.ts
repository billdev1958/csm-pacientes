/**
 * Roles del sistema. Los identificadores coinciden con la tabla `cat_role` del
 * backend, sembrada en `SeedRoles` (internal/infraestructure/db/postgres.go).
 */
export const Role = {
  SuperAdmin: 1,
  Admin: 2,
  Doctor: 3,
  Receptionist: 4,
  Patient: 5,
} as const;

export type RoleId = (typeof Role)[keyof typeof Role];

/**
 * Etiqueta de puesto que se muestra en la cabecera y el tablero: vocabulario en
 * mayúsculas orientado al área, no al nombre técnico del rol.
 *
 * Para un rol desconocido no se inventa un puesto: hacerlo haría que un usuario
 * sin rol asignado apareciera como personal administrativo.
 */
export function positionLabel(roleId: number | undefined | null): string {
  switch (roleId) {
    case Role.SuperAdmin:
      return 'SÚPER ADMINISTRACIÓN';
    case Role.Admin:
      return 'ADMINISTRACIÓN CENTRAL';
    case Role.Doctor:
      return 'MÉDICO TITULAR';
    case Role.Receptionist:
      return 'RECEPCIÓN Y CITAS';
    case Role.Patient:
      return 'PACIENTE REGISTRADO';
    default:
      return 'SIN ROL ASIGNADO';
  }
}
