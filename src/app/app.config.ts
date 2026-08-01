import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // El orden importa: authInterceptor pone el token antes de que salga la
    // petición, y errorInterceptor envuelve la respuesta, así que ve los 401 que
    // vuelven con el token ya adjunto.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
