"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapaPunto } from "../../../_hooks";

// Fix de íconos del marker bajo Turbopack (PNG -> StaticImageData, usar .src).
L.Icon.Default.mergeOptions({
  iconUrl: (iconUrl as { src: string }).src,
  iconRetinaUrl: (iconRetinaUrl as { src: string }).src,
  shadowUrl: (shadowUrl as { src: string }).src,
});

// Vista inicial: Venezuela completa (se ajusta a los marcadores si hay).
const VENEZUELA: [number, number] = [8, -66];

function FitBounds({ puntos }: { puntos: MapaPunto[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, puntos]);
  return null;
}

export default function MapaCentros({ puntos }: { puntos: MapaPunto[] }) {
  return (
    <MapContainer
      center={VENEZUELA}
      zoom={6}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {puntos.map((p) => (
        <Marker key={p.id} position={[p.latitud, p.longitud]}>
          <Popup>
            <strong>{p.nombre}</strong>
            <br />
            {p.ciudad}
            <br />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitud},${p.longitud}`}
              target="_blank"
              rel="noreferrer"
            >
              Cómo llegar
            </a>
          </Popup>
        </Marker>
      ))}
      <FitBounds puntos={puntos} />
    </MapContainer>
  );
}
