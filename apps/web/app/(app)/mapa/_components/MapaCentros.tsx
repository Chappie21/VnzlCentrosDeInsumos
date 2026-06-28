"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapaPunto } from "../../../_hooks";

// Punto coloreado por estado (verde=recibiendo, gris=inactivo). DivIcon en vez de
// la imagen default de leaflet: evita el marker roto y es literalmente un punto.
const dotIcon = (activo: boolean) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);background:${activo ? "#16a34a" : "#9ca3af"}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
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
        <Marker
          key={p.id}
          position={[p.latitud, p.longitud]}
          icon={dotIcon(p.recibiendoAhora)}
        >
          <Popup>
            <strong>{p.nombre}</strong>
            <br />
            {p.ciudad}
            <br />
            {p.recibiendoAhora ? "🟢 Recibiendo ahora" : "⚪ Inactivo"}
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
