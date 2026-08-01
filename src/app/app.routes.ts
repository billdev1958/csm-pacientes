import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

/**
 * Todas las rutas usan `loadComponent` para que cada pantalla viaje en su propio
 * paquete: quien solo entra a identificarse no descarga el flujo de agendado.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión — CMS UAEMéx',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Crear cuenta — CMS UAEMéx',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'mis-citas',
    title: 'Mis citas — CMS UAEMéx',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/my-appointments/my-appointments').then(
        (m) => m.MyAppointments,
      ),
  },
  {
    path: 'agendar',
    title: 'Agendar cita — CMS UAEMéx',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/book-appointment/book-appointment').then(
        (m) => m.BookAppointment,
      ),
  },
  { path: '', redirectTo: 'mis-citas', pathMatch: 'full' },
  // Ruta comodín: sin ella una URL desconocida (un marcador viejo, una errata)
  // renderiza una página en blanco sin navegación.
  { path: '**', redirectTo: 'mis-citas' },
];
