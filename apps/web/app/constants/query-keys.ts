export const QK = { centros: "centros" } as const;

export type CentrosFilters = {
  q: string;
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
  mapa: () => [QK.centros, "mapa"] as const,
  mios: () => [QK.centros, "mios"] as const,
  detalle: (id: string) => [QK.centros, "detalle", id] as const,
  voluntarios: (centroId: string) => [QK.centros, "voluntarios", centroId] as const,
};
