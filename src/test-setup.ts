import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';

// `main.ts` registra el idioma al arrancar la aplicación, pero las pruebas no
// pasan por ahí: sin esto el pipe `date` con 'es-MX' lanza NG02100 y cualquier
// prueba que renderice una fecha falla por una razón que no es la que examina.
registerLocaleData(localeEsMx);
