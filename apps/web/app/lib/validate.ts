export type OnboardingInput = { nombre: string; cedula: string; telefono: string };
export type OnboardingErrors = { nombre?: string; cedula?: string; telefono?: string };

// Cédula VE: V12345678 / V-12345678 / E-1234567. Normaliza a V12345678 (sin guion).
const CEDULA_RE = /^[VEve]-?\d{6,8}$/;

export function normalizeCedula(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/-/g, "");
  return v;
}

export function normalizeTelefono(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function validateOnboarding(body: OnboardingInput): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (body.nombre.trim().length < 3) {
    errors.nombre = "El nombre debe tener al menos 3 caracteres.";
  }

  const cedula = body.cedula.trim();
  if (!CEDULA_RE.test(cedula)) {
    errors.cedula = "Cédula inválida. Ej: V12345678.";
  }

  const tel = normalizeTelefono(body.telefono);
  if (!/^\+?\d{7,15}$/.test(tel)) {
    errors.telefono = "Teléfono inválido. Solo dígitos (y opcional +).";
  }

  return errors;
}
