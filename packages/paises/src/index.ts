import { VENEZUELA } from "./data";
import { COLOMBIA } from "./data.co";
import type { Pais } from "./paises";

export { VENEZUELA, COLOMBIA };
export { PAISES, PAIS_META, esPaisValido } from "./paises";
export type { Pais, PaisMeta } from "./paises";
export {
  parseDocumento,
  normalizarDocumento,
  normalizarTelefono,
  esTelefonoValido,
} from "./documento";
export type { TipoCedula, DocumentoParseado, DocumentoParseResult } from "./documento";
export { distanciaMetros } from "./geo";

const DIVISIONES: Record<Pais, Record<string, readonly string[]>> = {
  VE: VENEZUELA,
  CO: COLOMBIA,
};

export function estadosDe(pais: Pais): readonly string[] {
  return Object.keys(DIVISIONES[pais]);
}

export function ciudadesDe(pais: Pais, estado: string): readonly string[] {
  return DIVISIONES[pais][estado] ?? [];
}

// Whitelist para validar en el boundary (API) o en la UI (web).
export function esEstadoValido(pais: Pais, estado: string): boolean {
  return estado in DIVISIONES[pais];
}

export function esCiudadValida(pais: Pais, estado: string, ciudad: string): boolean {
  return ciudadesDe(pais, estado).includes(ciudad);
}
