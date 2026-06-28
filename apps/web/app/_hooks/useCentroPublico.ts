"use client";

import { useQuery } from "@tanstack/react-query";
import { getCentroPublico } from "../lib/api";
import { centrosKeys } from "../constants";

// Detalle público de un centro (cualquiera puede verlo desde el directorio).
export function useCentroPublico(id: string) {
  return useQuery({
    queryKey: centrosKeys.publico(id),
    queryFn: () => getCentroPublico(id),
    enabled: Boolean(id),
  });
}
