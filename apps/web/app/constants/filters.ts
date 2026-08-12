import type { IconName } from "./icons";

export const FILTERS = {
  cerca: "cerca",
  abiertos: "soloAbiertos",
  urgencia: "urgenciaAlta",
} as const;

export type FilterId = (typeof FILTERS)[keyof typeof FILTERS];

export const FILTER_CHIPS: { id: FilterId; label: string; icon: IconName }[] = [
  { id: FILTERS.cerca, label: "Cerca de mí", icon: "near_me" },
  { id: FILTERS.abiertos, label: "Solo Abiertos", icon: "check_circle" },
  { id: FILTERS.urgencia, label: "Urgencia Alta", icon: "priority_high" },
  // Sin chip "Verificados": el directorio ya solo lista centros verificados, así
  // que el filtro no filtraba nada.
];

export const DEBOUNCE_MS = 300;
// Redondeo de coords en la query-key: evita que el jitter del GPS dispare refetches.
export const GEO_PRECISION = 3;

// Niveles de insumo (espejo del enum del backend) -> clases de badge.
export const NIVEL_BADGE: Record<string, string> = {
  URGENTE: "bg-emergency text-white",
  NORMAL: "bg-surface-container text-on-surface-variant",
  SUFICIENTE: "bg-safety text-white",
};

// Categoría de insumo -> ícono Material. Fallback genérico si falta/llega otra.
export const CATEGORIA_ICON: Record<string, IconName> = {
  AGUA: "water_drop",
  MEDICAMENTOS: "medical_services",
  ROPA: "checkroom",
  ALIMENTOS: "restaurant",
  HERRAMIENTAS: "handyman",
};
export const CATEGORIA_ICON_FALLBACK: IconName = "inventory_2";
