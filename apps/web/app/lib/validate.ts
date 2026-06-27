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

export type CentroInput = {
  nombre: string;
  ciudad: string;
  estado: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
};
export type CentroErrors = {
  nombre?: string;
  ciudad?: string;
  estado?: string;
  direccion?: string;
  latitud?: string;
  longitud?: string;
};

// Mismas reglas que el backend (apps/api CreateCentroDto), para no recibir 400.
export function validateCentro(body: CentroInput): CentroErrors {
  const errors: CentroErrors = {};

  if (body.nombre.trim().length < 3) {
    errors.nombre = "El nombre debe tener al menos 3 caracteres.";
  }

  if (body.ciudad.trim().length === 0) {
    errors.ciudad = "La ciudad es obligatoria.";
  }

  if (body.estado.trim().length === 0) {
    errors.estado = "El estado / provincia es obligatorio.";
  }

  if (body.direccion.trim().length < 5) {
    errors.direccion = "La dirección debe tener al menos 5 caracteres.";
  }

  if (body.latitud !== undefined) {
    if (!Number.isFinite(body.latitud) || body.latitud < -90 || body.latitud > 90) {
      errors.latitud = "Latitud inválida (−90 a 90).";
    }
  }

  if (body.longitud !== undefined) {
    if (
      !Number.isFinite(body.longitud) ||
      body.longitud < -180 ||
      body.longitud > 180
    ) {
      errors.longitud = "Longitud inválida (−180 a 180).";
    }
  }

  return errors;
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
