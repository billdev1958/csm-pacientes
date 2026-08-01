import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // App monta RouterOutlet y RouterLink, y su AuthService inyecta HttpClient.
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

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
});
