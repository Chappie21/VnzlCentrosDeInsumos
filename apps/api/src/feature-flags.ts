import { flags } from "railway";

// Feature flags de Railway (Settings → Feature Flags). Fuente de verdad ÚNICA:
// el frontend no define su propia copia, lee la de acá vía GET /config/flags.
//
// El SDK sincroniza el registro una vez al arrancar y lo refresca en background,
// así que las lecturas son síncronas y en memoria — sin latencia por request y
// sin redeploy para cambiar un valor.

/** Portón de verificación de cédula contra el registro civil venezolano. */
export const FLAG_CEDULA_VE = "cedula-validacion-ve";

// Valor seguro cuando el registro todavía no sincronizó (arranque, red caída) o
// cuando no hay token (dev local, tests): mantener el portón activo preserva el
// comportamiento histórico y nunca crea cuentas sin nombre.
const DEFAULT_CEDULA_VE = true;

// ponytail: un booleano en una variable de módulo. Sin token no hay registro que
// leer y todo cae al default, que es justo lo que queremos en local.
let sincronizado = false;

// Se llama una vez en el arranque. Nunca lanza: si Railway no responde, la API
// arranca igual y los flags sirven sus defaults.
export async function initFeatureFlags(): Promise<boolean> {
  try {
    await flags.init({ timeoutMs: 3000 });
    sincronizado = true;
  } catch {
    sincronizado = false;
  }
  return sincronizado;
}

export function flagsSincronizados(): boolean {
  return sincronizado;
}

export function cedulaValidacionVe(): boolean {
  if (!sincronizado) return DEFAULT_CEDULA_VE;
  try {
    return flags.getBoolean(FLAG_CEDULA_VE, undefined, DEFAULT_CEDULA_VE);
  } catch {
    return DEFAULT_CEDULA_VE;
  }
}
