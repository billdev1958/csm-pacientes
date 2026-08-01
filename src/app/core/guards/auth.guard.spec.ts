import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot } from '@angular/router';
import { provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient()],
    });
    router = TestBed.inject(Router);
    // Se intercepta la navegación: el router de prueba no tiene rutas, así que
    // una navegación real fallaría con un error fuera de la aserción.
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function run(url: string) {
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard({} as never, state));
  }

  it('deja pasar cuando hay token', () => {
    localStorage.setItem('csm_paciente_token', 'un.token.valido');
    expect(run('/mis-citas')).toBe(true);
  });

  // El guard equivalente del panel de administración tenía un `return true`
  // incondicional, así que la protección existía en apariencia y no en efecto.
  it('bloquea cuando NO hay token', () => {
    expect(run('/mis-citas')).toBe(false);
  });

  it('redirige al login conservando el destino pretendido', () => {
    run('/agendar');

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/agendar' },
    });
  });
});
