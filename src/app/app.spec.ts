import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/** Claves con las que `AuthService` persiste la sesión. */
const TOKEN_KEY = 'csm_paciente_token';
const USER_KEY = 'csm_paciente_user';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      // App monta RouterOutlet y RouterLink, y su AuthService inyecta HttpClient.
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('monta el componente raíz', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sin sesión no muestra la navegación autenticada', async () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');
    expect(nav).toBeNull();
  });

  /** Deja una sesión en `localStorage` como la que dejaría un login correcto. */
  function iniciarSesion(displayName?: string): void {
    localStorage.setItem(TOKEN_KEY, 'token-de-prueba');
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        accountID: '22222222-2222-2222-2222-222222222222',
        role: 5,
        isActive: true,
        displayName,
      }),
    );
  }

  it('la barra dice quién está identificado cuando conoce el nombre', async () => {
    iniciarSesion('Prueba Portal Pacientes');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const nombre = (fixture.nativeElement as HTMLElement).querySelector('.account__name');
    expect(nombre?.textContent).toContain('Prueba Portal Pacientes');
  });

  // El login no devuelve el nombre, así que hasta pasar por "Agendar" no se
  // conoce. En ese hueco no se inventa un saludo genérico: no se pinta nada.
  it('no inventa un nombre mientras no lo conoce', async () => {
    iniciarSesion();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.account__name')).toBeNull();
    // El botón de salir sí sigue ahí.
    expect(raiz.querySelector('.account__logout')).not.toBeNull();
  });
});
