"use client";

import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { PAIS_META, type Pais } from "@vnzl/paises";
import type { Coords } from "../../../../_hooks";
import { pinIcon } from "../../../../_components/mapPin";

type MapProps = {
  value: Coords | null;
  onChange: (next: Coords) => void;
  // Encuadre inicial cuando todavía no hay punto elegido.
  pais: Pais;
  // bump para forzar recenter (p. ej. tras "Obtener ubicación actual")
  recenterKey?: number;
  zoom?: number;
};

function ClickToMove({ onChange }: { onChange: (p: Coords) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ value, recenterKey }: { value: Coords | null; recenterKey?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;
    map.setView([value.lat, value.lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
}

export default function Map({ value, onChange, pais, recenterKey, zoom = 13 }: MapProps) {
  const vista = PAIS_META[pais].mapa;
  const center = value ?? vista;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={value ? zoom : vista.zoom}
      scrollWheelZoom
      className="h-64 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng();
              onChange({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
      <ClickToMove onChange={onChange} />
      <Recenter value={value} recenterKey={recenterKey} />
    </MapContainer>
  );
}
