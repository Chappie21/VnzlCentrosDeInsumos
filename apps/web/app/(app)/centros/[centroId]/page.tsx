"use client";

import { useParams } from "next/navigation";
import { EmptyState, Icon } from "../../../_components";
import { useCentroPublico } from "../../../_hooks";
import NeedBadge from "../_components/NeedBadge";

export default function CentroDetallePublico() {
  const { centroId } = useParams<{ centroId: string }>();
  const { data: centro, isLoading, isError } = useCentroPublico(centroId);

  if (isLoading)
    return <p className="py-8 text-center text-on-surface-variant">Cargando…</p>;

  if (isError || !centro)
    return (
      <EmptyState
        icon="error"
        title="No se pudo cargar el centro"
        subtitle="Puede que no exista o que haya un problema de conexión."
      />
    );

  // "Cómo llegar": directions a las coords si las hay; si no, a la dirección.
  const destino =
    centro.latitud != null && centro.longitud != null
      ? `${centro.latitud},${centro.longitud}`
      : encodeURIComponent(`${centro.direccion}, ${centro.ciudad}, ${centro.estado}`);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;

  return (
    <div className="space-y-6 py-4">
      <header className="border-b border-outline-variant pb-4">
        <h1 className="text-2xl font-bold text-on-surface">{centro.nombre}</h1>

        <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
          <Icon name="location_on" className="text-[18px]" />
          {centro.ciudad}, {centro.estado}
        </p>
        <p className="mt-0.5 text-sm text-on-surface-variant">{centro.direccion}</p>

        <p className="mt-2 flex items-center gap-1 text-sm text-on-surface-variant">
          <Icon name="group" className="text-[16px]" />
          {centro.voluntarios} {centro.voluntarios === 1 ? "voluntario" : "voluntarios"}
        </p>

        {centro.recibiendoAhora ? (
          <span className="mt-3 inline-flex items-center gap-1 rounded-badge bg-emergency/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emergency">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emergency" aria-hidden />
            Recibiendo ahora
          </span>
        ) : (
          <span className="mt-3 inline-flex items-center gap-1 rounded-badge bg-surface-container px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name="schedule" className="text-[14px]" />
            {centro.horarioCierre ? `Cierra ${centro.horarioCierre}` : "Cerrado"}
          </span>
        )}
      </header>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emergency px-4 py-3 font-semibold text-white transition-colors hover:bg-[#b70011]"
      >
        <Icon name="directions" />
        Cómo llegar
      </a>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-on-surface">Necesidades</h2>
        {centro.necesidades.length > 0 ? (
          <ul className="space-y-2">
            {centro.necesidades.map((n) => (
              <li
                key={`${n.nombre}-${n.nivel}`}
                className="flex items-center justify-between gap-3"
              >
                <NeedBadge necesidad={n} />
                <span className="shrink-0 text-sm font-semibold text-on-surface">
                  {n.cantidad} uds.
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Este centro no tiene necesidades registradas.
          </p>
        )}
      </section>
    </div>
  );
}
