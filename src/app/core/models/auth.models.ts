/** Cuerpo de `POST /v1/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * `data` de un login correcto (`models.LoginResponse`).
 *
 * No incluye el nombre del usuario: el backend solo devuelve estos cuatro
 * campos, así que la interfaz no puede saludar al paciente por su nombre sin un
 * cambio en la API.
 */
export interface LoginResponseData {
  accountID: string;
  role: number;
  token: string;
  isActive: boolean;
}

/** Cuerpo de `POST /v1/patients` (registro público). */
export interface RegisterPatientRequest {
  email: string;
  password: string;
  name: string;
  lastname1: string;
  lastname2: string;
  curp: string;
  sex: 'M' | 'F';
  phoneNumber: string;
}

/** Cuerpo de `POST /v1/confirmation/verify`. */
export interface VerifyCodeRequest {
  email: string;
  code: string;
}
