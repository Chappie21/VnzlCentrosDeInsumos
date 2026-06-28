"use client";

import dynamic from "next/dynamic";
import { EmptyState } from "../../_components";
import { useCentrosMapa } from "../../_hooks";

// Leaflet toca window/document -> sin SSR.
const MapaCentros = dynamic(() => import("./_components/MapaCentros"), {
  ssr: false,
});

export default function MapaPage() {
  const { data, isLoading, isError } = useCentrosMapa();

  if (isError)
    return (
      <EmptyState
        icon="error"
        title="No se pudo cargar el mapa"
        subtitle="Revisá tu conexión e intentá de nuevo."
      />
    );

  return (
    // Alto disponible aprox. (descuenta TopAppBar + padding del layout).
    <div className="h-[calc(100dvh-9rem)] w-full">
      {isLoading ? (
        <p className="py-8 text-center text-on-surface-variant">Cargando mapa…</p>
      ) : (
        <MapaCentros puntos={data ?? []} />
      )}
    </div>
  );
}
