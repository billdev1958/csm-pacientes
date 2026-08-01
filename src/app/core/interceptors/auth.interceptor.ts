import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * Adjunta el token a las peticiones a la API.
 *
 * Solo a las de la API: si se añadiera a cualquier URL, un recurso externo (una
 * fuente, una imagen de un tercero) recibiría el token del paciente.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  if (!token || !req.url.includes('/v1/')) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
