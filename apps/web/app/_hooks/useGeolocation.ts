"use client";

import { useCallback, useState } from "react";

export type Coords = { lat: number; lng: number };

// Geolocalización a demanda: no pide permiso al montar, solo cuando se llama request()
// (p. ej. al activar el chip "Cerca de mí").
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);

  const request = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setDenied(true),
    );
  }, []);

  const clear = useCallback(() => setCoords(null), []);

  return { coords, denied, request, clear };
}
