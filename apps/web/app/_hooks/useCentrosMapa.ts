"use client";

import { useQuery } from "@tanstack/react-query";
import type { Pais } from "@vnzl/paises";
import { apiFetch } from "../lib/api";
import { centrosKeys } from "../constants";

export type MapaPunto = {
  id: string;
  nombre: string;
  ciudad: string;
  latitud: number;
  longitud: number;
  recibiendoAhora: boolean;
};

// Todos los centros con coordenadas, para pintarlos en el mapa público.
export function useCentrosMapa(pais: Pais) {
  return useQuery({
    queryKey: centrosKeys.mapa(pais),
    queryFn: async (): Promise<MapaPunto[]> => {
      const res = await apiFetch(`/centros/mapa?pais=${pais}`);
      if (!res.ok) throw new Error("No se pudo cargar el mapa");
      return res.json();
    },
  });
}
