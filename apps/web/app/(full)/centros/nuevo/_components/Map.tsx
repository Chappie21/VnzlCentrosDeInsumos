"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Coords } from "../../../../_hooks";

// Fix de íconos del marker bajo Turbopack (los imports de PNG son StaticImageData
// -> hay que usar .src). Corre una vez a nivel módulo.
L.Icon.Default.mergeOptions({
  iconUrl: (iconUrl as { src: string }).src,
  iconRetinaUrl: (iconRetinaUrl as { src: string }).src,
  shadowUrl: (shadowUrl as { src: string }).src,
});

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
