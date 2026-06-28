export const FILTERS = {
  cerca: "cerca",
  abiertos: "soloAbiertos",
  urgencia: "urgenciaAlta",
  verificado: "verificado",
} as const;

export type FilterId = (typeof FILTERS)[keyof typeof FILTERS];

export const FILTER_CHIPS: { id: FilterId; label: string; icon: string }[] = [
  { id: FILTERS.cerca, label: "Cerca de mí", icon: "near_me" },
  { id: FILTERS.abiertos, label: "Solo Abiertos", icon: "check_circle" },
  { id: FILTERS.urgencia, label: "Urgencia Alta", icon: "priority_high" },
  { id: FILTERS.verificado, label: "Verificados", icon: "verified" },
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
export const CATEGORIA_ICON: Record<string, string> = {
  AGUA: "water_drop",
  MEDICAMENTOS: "medical_services",
  ROPA: "checkroom",
  ALIMENTOS: "restaurant",
  HERRAMIENTAS: "handyman",
};
export const CATEGORIA_ICON_FALLBACK = "inventory_2";
