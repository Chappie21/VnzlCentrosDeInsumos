import type { RolCentro } from "../lib/api";

// Etiquetas legibles del rol del usuario en un centro.
export const ROL_LABEL: Record<RolCentro, string> = {
  JEFE: "Dueño",
  VOLUNTARIO: "Voluntario",
};

// Títulos de las dos secciones de "Mis Centros".
export const SECCIONES = {
  duenio: "Tus centros",
  voluntario: "Donde ayudás",
} as const;
