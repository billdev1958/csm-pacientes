import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición que el paciente no pidió.
 *
 * La usa el refresco de horarios en segundo plano: si la red se cae, ese sondeo
 * falla cada treinta segundos, y sin esto el portal sacaría una notificación
 * cada vez por algo que nadie solicitó. `errorInterceptor` la respeta para todo
 * menos el 401, que se anuncia siempre.
 *
 * Vive en su propio archivo y no dentro del interceptor porque lo importan los
 * dos extremos: el interceptor, que va en el paquete inicial, y los servicios,
 * que viajan en los paquetes de cada pantalla. Con el token dentro del
 * interceptor, esa importación cruzada reorganizaba los paquetes y sacaba el
 * marco de Angular del recuento inicial del presupuesto.
 */
export const SILENT_HTTP_ERRORS = new HttpContextToken<boolean>(() => false);
