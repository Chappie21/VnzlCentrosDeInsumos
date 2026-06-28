"use client";

import { useCallback, useState } from "react";

export type Coords = { lat: number; lng: number };

// Geolocalización: request() pide permiso (a demanda o al montar, según el caller).
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
