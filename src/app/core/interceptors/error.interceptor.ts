import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Traduce los fallos de red y de sesión a algo accionable.
 *
 * Deja pasar los errores de negocio (400, 404, 409) sin tocarlos: esos los
 * muestra cada pantalla junto al campo o la acción que los provocó, que es más
 * útil que una notificación global. El interceptor solo se ocupa de lo que la
 * pantalla no puede resolver por sí sola.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notifications.show('No se pudo conectar con el servidor. Revisa tu conexión.', 'error');
      } else if (error.status === 401) {
        // El token expiró o es inválido: no tiene sentido seguir en el portal.
        notifications.show('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
        auth.logout();
      } else if (error.status === 403) {
        notifications.show('No tienes acceso a ese recurso.', 'error');
      } else if (error.status >= 500) {
        // El mensaje del backend en un 500 es genérico por diseño; no aporta.
        notifications.show('Ocurrió un error en el servidor. Intenta más tarde.', 'error');
      }

      return throwError(() => error);
    }),
  );
};
