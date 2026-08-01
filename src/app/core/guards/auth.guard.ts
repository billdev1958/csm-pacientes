import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Exige sesión para entrar a las rutas del portal.
 *
 * Nace funcionando a propósito: en el panel de administración este guard llevaba
 * un `return true` incondicional con la comprobación real comentada, así que la
 * protección existía en apariencia y no en efecto.
 *
 * Guarda la URL pretendida en `returnUrl` para devolver a la persona a donde
 * quería ir después de identificarse, en lugar de dejarla en el inicio.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.getToken()) {
    return true;
  }

  void router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
