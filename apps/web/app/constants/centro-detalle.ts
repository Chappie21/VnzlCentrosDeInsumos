import type { NivelInsumo } from "../lib/api";

// Etiqueta y color del badge de nivel de cada insumo.
export const NIVEL_LABEL: Record<NivelInsumo, string> = {
  URGENTE: "Urgente",
  NORMAL: "Normal",
  SUFICIENTE: "Suficiente",
};

// El badge de color (NIVEL_BADGE) vive en ./filters y se reusa aquí.

// Opciones del selector de nivel (orden de gravedad descendente).
export const NIVELES: readonly NivelInsumo[] = ["URGENTE", "NORMAL", "SUFICIENTE"];

// Títulos de los recuadros de stats del dashboard.
export const STATS = {
  insumos: "Insumos",
  voluntarios: "Voluntarios",
  criticos: "Items críticos",
} as const;
