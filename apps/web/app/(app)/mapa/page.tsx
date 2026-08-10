"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { EmptyState } from "../../_components";
import { useCentrosMapa } from "../../_hooks";
import { paisActual, PAIS_POR_DEFECTO } from "../../lib/pais";

// Leaflet toca window/document -> sin SSR.
const MapaCentros = dynamic(() => import("./_components/MapaCentros"), {
  ssr: false,
});

export default function MapaPage() {
  const [pais, setPais] = useState(PAIS_POR_DEFECTO);
  useEffect(() => setPais(paisActual()), []);

  const { data, isLoading, isError } = useCentrosMapa(pais);

  if (isError)
    return (
      <EmptyState
        icon="error"
        title="No se pudo cargar el mapa"
        subtitle="Revisa tu conexión e intenta de nuevo."
      />
    );

  return (
    // Alto disponible aprox. (descuenta TopAppBar + padding del layout).
    <div className="h-[calc(100dvh-9rem)] w-full">
      {isLoading ? (
        <p className="py-8 text-center text-on-surface-variant">Cargando mapa…</p>
      ) : (
        <MapaCentros puntos={data ?? []} pais={pais} />
      )}
    </div>
  );
}
