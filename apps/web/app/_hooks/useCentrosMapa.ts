"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { centrosKeys } from "../constants";

export type MapaPunto = {
  id: string;
  nombre: string;
  ciudad: string;
  latitud: number;
  longitud: number;
};

// Todos los centros con coordenadas, para pintarlos en el mapa público.
export function useCentrosMapa() {
  return useQuery({
    queryKey: centrosKeys.mapa(),
    queryFn: async (): Promise<MapaPunto[]> => {
      const res = await apiFetch("/centros/mapa");
      if (!res.ok) throw new Error("No se pudo cargar el mapa");
      return res.json();
    },
  });
}
