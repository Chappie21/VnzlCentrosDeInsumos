"use client";

import { useQuery } from "@tanstack/react-query";
import { getVoluntarios } from "../lib/api";
import { centrosKeys } from "../constants";

// Lista de voluntarios de un centro (solo JEFE). Fingerprint en header (apiFetch).
export function useVoluntarios(centroId: string) {
  return useQuery({
    queryKey: centrosKeys.voluntarios(centroId),
    queryFn: () => getVoluntarios(centroId),
    enabled: Boolean(centroId),
  });
}
