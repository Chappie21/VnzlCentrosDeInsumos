"use client";

import { useEffect, useState } from "react";

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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Home() {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Ask for location; if denied, list stays unsorted and the user filters manually (spec §4.1).
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(null),
    );
  }, []);

  useEffect(() => {
    const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
    fetch(`${API}/centros${q}`)
      .then((r) => r.json())
      .then((d) => setCentros(Array.isArray(d) ? d : []))
      .catch(() => setCentros([]));
  }, [coords]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Centros de Acopio Activos</h1>
      <p className="mt-1 text-sm text-slate-500">
        {coords ? "Ordenados por cercanía a tu ubicación" : "Activa la ubicación para ordenar por cercanía"}
      </p>

      <ul className="mt-6 space-y-4">
        {centros.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{c.nombre}</h2>
              {c.distanciaKm != null && (
                <span className="text-sm text-emerald-600">{c.distanciaKm.toFixed(1)} km</span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {c.ciudad}, {c.estado} — {c.direccion}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {c.insumos.map((i) => (
                <li key={i.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                  {i.nombre}: <b>{i.cantidadTotal}</b>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {centros.length === 0 && <p className="text-slate-400">No hay centros todavía.</p>}
      </ul>
    </main>
  );
}
