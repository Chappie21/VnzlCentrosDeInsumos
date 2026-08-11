import type { Pais } from "./paises";

export type TipoCedula = "V" | "E";

export interface DocumentoParseado {
  numero: number;
  formatted: string; // "V-28252900" (VE) | "1020304050" (CO)
  // Nacionalidad. Solo Venezuela la usa: api.cedula.com.ve la exige como parámetro.
  tipo?: TipoCedula;
}

export interface DocumentoParseResult {
  valid: boolean;
  data?: DocumentoParseado;
  error?: string;
}

const CEDULA_VE_RE = /^([VE])-?(\d{6,8})$/;
const RANGO_VE = { min: 100_000, max: 40_000_000 };

// Cédula de ciudadanía / de extranjería colombiana: numérica, sin letra de
// nacionalidad. Las viejas tienen 6-8 dígitos, las nuevas 10 (1.0xx.xxx.xxx).
// ponytail: solo se valida longitud — la CC no tiene dígito verificador público
// (el que sí lo tiene es el NIT), así que no hay checksum que comprobar offline.
const CEDULA_CO_RE = /^(\d{6,10})$/;

const TELEFONO_RE: Record<Pais, RegExp> = {
  VE: /^(?:\+?58|0)?4(?:12|14|16|24|26)\d{7}$/,
  // Móvil colombiano: 10 dígitos que siempre empiezan en 3, con +57 opcional.
  CO: /^(?:\+?57)?3\d{9}$/,
};

// Valida el FORMATO del documento de identidad según el país (no su existencia).
// Tolera puntos de miles y espacios ("V-28.252.900", "1.020.304.050"). Offline.
export function parseDocumento(pais: Pais, raw: string): DocumentoParseResult {
  const clean = raw.trim().toUpperCase().replace(/[.\s]/g, "");

  if (pais === "CO") {
    const match = clean.match(CEDULA_CO_RE);
    if (!match) {
      return { valid: false, error: "Formato inválido. Esperado: 1020304050" };
    }
    const numero = parseInt(match[1], 10);
    return { valid: true, data: { numero, formatted: String(numero) } };
  }

  const match = clean.match(CEDULA_VE_RE);
  if (!match) {
    return { valid: false, error: "Formato inválido. Esperado: V-12345678 o E-1234567" };
  }
  const tipo = match[1] as TipoCedula;
  const numero = parseInt(match[2], 10);
  if (numero < RANGO_VE.min || numero > RANGO_VE.max) {
    return { valid: false, error: `Número fuera de rango (${RANGO_VE.min}–${RANGO_VE.max})` };
  }
  return { valid: true, data: { tipo, numero, formatted: `${tipo}-${numero}` } };
}

// Mayúsculas, sin puntos/espacios/guiones.
export function normalizarDocumento(pais: Pais, raw: string): string {
  const v = raw.toUpperCase().replace(/[.\s-]/g, "");
  // ponytail: el prefijo "V" implícito para dígitos sueltos es una comodidad SOLO
  // venezolana. Aplicarlo en Colombia guardaría "V1020304050" y el usuario no
  // volvería a entrar a su propia cuenta.
  return pais === "VE" && /^\d+$/.test(v) ? "V" + v : v;
}

// Quita espacios, guiones y paréntesis. Agnóstico del país.
export function normalizarTelefono(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

export function esTelefonoValido(pais: Pais, telefono: string): boolean {
  return TELEFONO_RE[pais].test(normalizarTelefono(telefono));
}
