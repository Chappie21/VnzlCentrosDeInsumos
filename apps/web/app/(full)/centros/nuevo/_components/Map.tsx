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
import type { Coords } from "../../../../_hooks";
import { pinIcon } from "../../../../_components/mapPin";

// Centro por defecto: Caracas (el usuario reposiciona clickeando o arrastrando).
const CARACAS: Coords = { lat: 10.4806, lng: -66.9036 };

type MapProps = {
  value: Coords | null;
  onChange: (next: Coords) => void;
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

export default function Map({ value, onChange, recenterKey, zoom = 13 }: MapProps) {
  const center = value ?? CARACAS;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
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
