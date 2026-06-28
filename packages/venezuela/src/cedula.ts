export type TipoCedula = "V" | "E";

export interface CedulaParseada {
  tipo: TipoCedula;
  numero: number;
  formatted: string; // "V-28252900"
}

export interface CedulaParseResult {
  valid: boolean;
  data?: CedulaParseada;
  error?: string;
}

const CEDULA_RE = /^([VE])-?(\d{6,8})$/;
const RANGO = { min: 100_000, max: 40_000_000 };

// Valida el FORMATO de una cédula venezolana (no su existencia). Tolera puntos de
// miles y espacios ("V-28.252.900"). Offline; nada de CNE.
export function parseCedula(raw: string): CedulaParseResult {
  const clean = raw.trim().toUpperCase().replace(/[.\s]/g, "");
  const match = clean.match(CEDULA_RE);
  if (!match) {
    return { valid: false, error: "Formato inválido. Esperado: V-12345678 o E-1234567" };
  }
  const tipo = match[1] as TipoCedula;
  const numero = parseInt(match[2], 10);
  if (numero < RANGO.min || numero > RANGO.max) {
    return { valid: false, error: `Número fuera de rango (${RANGO.min}–${RANGO.max})` };
  }
  return { valid: true, data: { tipo, numero, formatted: `${tipo}-${numero}` } };
}
