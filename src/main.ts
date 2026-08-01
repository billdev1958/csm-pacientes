import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

// Las fechas de las citas se muestran con el pipe `date` y el locale 'es-MX'.
// Sin registrarlo, Angular lanza en tiempo de ejecución al formatear.
registerLocaleData(localeEsMx);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
