export type OnboardingInput = { nombre: string; cedula: string; telefono: string };
export type OnboardingErrors = { nombre?: string; cedula?: string; telefono?: string };

// Mismas reglas que el backend (apps/api OnboardDto), para no recibir 400.
const CEDULA_RE = /^[VE]\d{6,9}$/;
const TELEFONO_RE = /^(?:\+?58|0)?4(?:12|14|16|24|26)\d{7}$/;

// Mayúsculas, sin puntos/espacios/guiones; dígitos solos -> prefijo V.
export function normalizeCedula(raw: string): string {
  let v = raw.toUpperCase().replace(/[.\s-]/g, "");
  if (/^\d+$/.test(v)) v = "V" + v;
  return v;
}

// Quita espacios, guiones y paréntesis.
export function normalizeTelefono(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

export function validateOnboarding(body: OnboardingInput): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (body.nombre.trim().length < 3) {
    errors.nombre = "El nombre debe tener al menos 3 caracteres.";
  }

  if (!CEDULA_RE.test(normalizeCedula(body.cedula))) {
    errors.cedula = "Cédula inválida. Ej: V12345678 o E1234567.";
  }

  if (!TELEFONO_RE.test(normalizeTelefono(body.telefono))) {
    errors.telefono = "Teléfono móvil venezolano inválido. Ej: 04141234567.";
  }

  return errors;
}
