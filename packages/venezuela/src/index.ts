import { VENEZUELA } from "./data";

export { VENEZUELA };

export const ESTADOS: readonly string[] = Object.keys(VENEZUELA);

export function municipiosDe(estado: string): readonly string[] {
  return VENEZUELA[estado] ?? [];
}

// Whitelist para validar en el boundary (API) o en la UI (web).
export function esEstadoValido(estado: string): boolean {
  return estado in VENEZUELA;
}

export function esCiudadValida(estado: string, ciudad: string): boolean {
  return municipiosDe(estado).includes(ciudad);
}
