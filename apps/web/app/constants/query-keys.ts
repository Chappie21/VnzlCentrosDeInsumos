import type { Pais } from "@vnzl/paises";

export const QK = { centros: "centros" } as const;

export type CentrosFilters = {
  q: string;
  pais: Pais;
  soloAbiertos: boolean;
  urgenciaAlta: boolean;
  verificado: boolean;
  lat: number | null;
  lng: number | null;
  cerca: boolean;
};

// Factory de query-keys: la key incluye los filtros (sin fingerprint, jamás).
export const centrosKeys = {
  list: (filters: CentrosFilters) => [QK.centros, "list", filters] as const,
  mapa: (pais: Pais) => [QK.centros, "mapa", pais] as const,
  mios: () => [QK.centros, "mios"] as const,
  detalle: (id: string) => [QK.centros, "detalle", id] as const,
  publico: (id: string) => [QK.centros, "publico", id] as const,
  voluntarios: (centroId: string) => [QK.centros, "voluntarios", centroId] as const,
};
