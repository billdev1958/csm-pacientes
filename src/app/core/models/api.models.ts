/**
 * Sobre de respuesta del backend Go (`models.Response`).
 *
 * Los tres últimos campos llevan `omitempty` en Go, así que son opcionales de
 * verdad: declararlos obligatorios fue la causa de un TypeError en el panel de
 * administración, donde `data` se leía sin comprobar y llegaba `undefined` en las
 * respuestas de error.
 *
 * `errors` se declara aquí solo para reflejar la forma real de la respuesta.
 * NO se muestra al usuario: el backend pone ahí el detalle interno del error.
 * Para la interfaz se usa `message`.
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error' | 'conflict';
  message?: string;
  data?: T;
  errors?: string;
}

/** Respuesta paginada (`pkg/util/pagination`). */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * El backend acota el tamaño de página a 100 y el cuerpo de la petición a 1 MiB
 * (pkg/util/pagination y middleware.BodyLimit). Pedir más no da error: el
 * servidor lo recorta en silencio.
 */
export const MAX_PAGE_SIZE = 100;
