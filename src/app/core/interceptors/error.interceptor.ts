import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Marca una petición que el paciente no pidió.
 *
 * La usa el refresco de horarios en segundo plano: si la red se cae, ese sondeo
 * falla cada treinta segundos, y sin esto el portal sacaría una notificación
 * cada vez por algo que nadie solicitó.
 */
export const SILENT_HTTP_ERRORS = new HttpContextToken<boolean>(() => false);

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
      if (error.status === 401) {
        // El token expiró o es inválido: no tiene sentido seguir en el portal.
        // Se avisa aunque la petición fuese silenciosa, porque a partir de aquí
        // ya no va a funcionar nada más.
        notifications.show('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
        auth.logout();
        return throwError(() => error);
      }

      // Una petición silenciosa es una que el paciente no pidió: que falle no
      // puede interrumpir lo que esté haciendo.
      if (req.context.get(SILENT_HTTP_ERRORS)) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        notifications.show('No se pudo conectar con el servidor. Revisa tu conexión.', 'error');
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
