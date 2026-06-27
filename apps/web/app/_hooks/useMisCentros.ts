"use client";

import { useQuery } from "@tanstack/react-query";
import { getMisCentros } from "../lib/api";
import { centrosKeys } from "../constants";

// Lista personal de centros (chica): query simple, sin scroll infinito.
export function useMisCentros() {
  return useQuery({
    queryKey: centrosKeys.mios(),
    queryFn: getMisCentros,
  });
}
