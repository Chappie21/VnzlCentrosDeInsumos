"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { centrosKeys, type CentrosFilters } from "../constants";

export type Necesidad = {
  nombre: string;
  nivel: string; // URGENTE | NORMAL | SUFICIENTE
  categoria: string | null;
};

export type CentroCard = {
  id: string;
  nombre: string;
  ciudad: string;
  estado: string;
  direccion: string;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  distanciaKm: number | null;
  prioridadAlta: boolean;
  necesidades: Necesidad[];
};

export type CentrosPage = {
  items: CentroCard[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

function buildQuery(filters: CentrosFilters, page: number): string {
  const p = new URLSearchParams();
  p.set("page", String(page));
  if (filters.q) p.set("q", filters.q);
  if (filters.soloAbiertos) p.set("soloAbiertos", "true");
  if (filters.urgenciaAlta) p.set("urgenciaAlta", "true");
  if (filters.lat != null && filters.lng != null) {
    p.set("lat", String(filters.lat));
    p.set("lng", String(filters.lng));
  }
  return p.toString();
}

// Listado paginado con scroll infinito. El fingerprint viaja solo en el header (apiFetch).
export function useCentros(filters: CentrosFilters) {
  return useInfiniteQuery({
    queryKey: centrosKeys.list(filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CentrosPage> => {
      const res = await apiFetch(`/centros?${buildQuery(filters, pageParam)}`);
      if (!res.ok) throw new Error("No se pudo cargar el directorio");
      return res.json();
    },
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
}
