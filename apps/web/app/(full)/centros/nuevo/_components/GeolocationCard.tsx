"use client";

import dynamic from "next/dynamic";
import { Field, Icon } from "../../../../_components";
import type { Coords } from "../../../../_hooks";

// Mapa Leaflet: solo en cliente (usa window). El wrapper ssr:false vive acá,
// detrás del boundary "use client".
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-lg bg-surface-container" />
  ),
});

type GeolocationCardProps = {
  coords: Coords | null;
  denied: boolean;
  onRequest: () => void;
  onPick: (p: Coords) => void;
  recenterKey?: number;
  lat: string;
  lng: string;
};

export default function GeolocationCard({
  coords,
  denied,
  onRequest,
  onPick,
  recenterKey,
  lat,
  lng,
}: GeolocationCardProps) {
  return (
    <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-center gap-2 text-on-surface">
        <span className="text-on-surface-variant">
          <Icon name="settings" />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Geolocalización
        </h3>
      </div>

      <button
        type="button"
        onClick={onRequest}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#3d6649] active:scale-[0.98]"
      >
        <Icon name="my_location" />
        Obtener Ubicación Actual
      </button>

      {denied && (
        <p className="text-xs text-emergency">
          Permiso de ubicación denegado. Tocá el mapa para marcar la ubicación o
          intentá de nuevo desde los ajustes del navegador.
        </p>
      )}

      {/* Mapa interactivo: tocar o arrastrar el marcador fija lat/lng. */}
      <Map value={coords} onChange={onPick} recenterKey={recenterKey} />
      <p className="text-xs text-on-surface-variant">
        Tocá el mapa o arrastrá el marcador para fijar la ubicación.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Latitud"
          icon="north"
          readOnly
          placeholder="00.000000"
          value={lat}
        />
        <Field
          label="Longitud"
          icon="east"
          readOnly
          placeholder="00.000000"
          value={lng}
        />
      </div>
    </div>
  );
}
