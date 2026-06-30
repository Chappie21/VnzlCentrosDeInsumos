"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

// Fix de íconos del marker: el import del PNG puede ser un string (Turbopack)
// o un StaticImageData {src} (Webpack). Resolver ambos casos.
const asUrl = (m: unknown): string =>
  typeof m === "string" ? m : ((m as { src?: string })?.src ?? "");

L.Icon.Default.mergeOptions({
  iconUrl: asUrl(iconUrl),
  iconRetinaUrl: asUrl(iconRetinaUrl),
  shadowUrl: asUrl(shadowUrl),
});

// Mapa read-only que muestra un punto exacto (evidencia de moderación).
// ponytail: una instancia por card; si la cola crece mucho, renderizar bajo demanda.
export default function MiniMapa({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-48 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} />
    </MapContainer>
  );
}
