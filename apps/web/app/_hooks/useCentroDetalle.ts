"use client";

import { useQuery } from "@tanstack/react-query";
import { getCentroDetalle } from "../lib/api";
import { centrosKeys } from "../constants";

// Detalle de un centro (solo miembros). Fingerprint en header (apiFetch).
export function useCentroDetalle(id: string) {
  return useQuery({
    queryKey: centrosKeys.detalle(id),
    queryFn: () => getCentroDetalle(id),
    enabled: Boolean(id),
  });
}
