"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { requireHelp, syncIdentity } from "../lib/identity";
import Icon from "../_components/Icon";

type Insumo = { id: string; nombre: string; cantidadTotal: number };
type Centro = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  insumos: Insumo[];
  distanciaKm?: number | null;
};

export default function Centros() {
  const router = useRouter();
  const [centros, setCentros] = useState<Centro[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Rehydrate identity from the device's backend record if localStorage was cleared.
  useEffect(() => {
    void syncIdentity();
  }, []);

  // Ask for location; if denied, list stays unsorted and the user filters manually (spec §4.1).
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(null),
    );
  }, []);

  useEffect(() => {
    const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
    apiFetch(`/centros${q}`)
      .then((r) => r.json())
      .then((d) => setCentros(Array.isArray(d) ? d : []))
      .catch(() => setCentros([]));
  }, [coords]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Centros de Acopio Activos</h1>
          <p className="mt-1 text-sm text-outline">
            {coords
              ? "Ordenados por cercanía a tu ubicación"
              : "Activa la ubicación para ordenar por cercanía"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => requireHelp(router, "/centros")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-badge bg-emergency px-4 text-sm font-semibold text-white"
        >
          <Icon name="volunteer_activism" />
          Ayudar
        </button>
      </div>

      <ul className="mt-6 space-y-4">
        {centros.map((c) => (
          <li key={c.id} className="rounded-card border border-border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{c.nombre}</h2>
              {c.distanciaKm != null && (
                <span className="text-sm text-success">{c.distanciaKm.toFixed(1)} km</span>
              )}
            </div>
            <p className="text-sm text-outline">
              {c.ciudad}, {c.estado} — {c.direccion}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {c.insumos.map((i) => (
                <li key={i.id} className="rounded-badge bg-surface px-3 py-1 text-sm">
                  {i.nombre}: <b>{i.cantidadTotal}</b>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {centros.length === 0 && <p className="text-outline">No hay centros todavía.</p>}
      </ul>
    </main>
  );
}
