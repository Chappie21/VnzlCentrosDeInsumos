import {
  esCiudadValida,
  esEstadoValido,
  esTelefonoValido,
  normalizarDocumento,
  normalizarTelefono,
  parseDocumento,
  PAIS_META,
  type Pais,
} from "@vnzl/paises";

// Las reglas de formato viven en @vnzl/paises, que también usa la API: una sola
// definición en vez de dos regex que se van desincronizando.
export { normalizarDocumento as normalizeCedula, normalizarTelefono as normalizeTelefono };

export type OnboardingInput = { pais: Pais; nombre: string; cedula: string; telefono: string };
export type OnboardingErrors = { nombre?: string; cedula?: string; telefono?: string };

export type CentroInput = {
  pais: Pais;
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

  const meta = PAIS_META[body.pais];

  if (!esEstadoValido(body.pais, body.estado)) {
    errors.estado = `${meta.labelEstado} inválido.`;
  } else if (!esCiudadValida(body.pais, body.estado, body.ciudad)) {
    errors.ciudad = `${meta.labelCiudad} inválido para ese ${meta.labelEstado.toLowerCase()}.`;
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

  const meta = PAIS_META[body.pais];

  // Normalizar primero: en Venezuela el prefijo "V" es implícito y el formulario
  // acepta que se teclee solo el número.
  if (!parseDocumento(body.pais, normalizarDocumento(body.pais, body.cedula)).valid) {
    errors.cedula = `Documento inválido. Ej: ${meta.ejemploDocumento}.`;
  }

  if (!esTelefonoValido(body.pais, body.telefono)) {
    errors.telefono = `Teléfono móvil inválido. Ej: ${meta.ejemploTelefono}.`;
  }

  return errors;
}
