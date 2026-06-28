"use client";

import { useParams } from "next/navigation";
import { EmptyState, Icon } from "../../../_components";
import {
  CATEGORIA_ICON,
  CATEGORIA_ICON_FALLBACK,
  CATEGORIAS,
  NIVEL_BADGE,
  NIVEL_LABEL,
  STATS,
} from "../../../constants";
import { useCentroPublico } from "../../../_hooks";

const catLabel = (c: string) =>
  CATEGORIAS.find((x) => x.value === c)?.label ?? c;

function Stat({ icon, valor, label }: { icon: string; valor: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <Icon name={icon} className="text-on-surface-variant" />
      <span className="mt-1 text-xl font-bold text-on-surface">{valor}</span>
      <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

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

  const criticos = centro.necesidades.filter((n) => n.nivel === "URGENTE").length;

  // "Cómo llegar": directions a las coords si las hay; si no, a la dirección.
  const destino =
    centro.latitud != null && centro.longitud != null
      ? `${centro.latitud},${centro.longitud}`
      : encodeURIComponent(`${centro.direccion}, ${centro.ciudad}, ${centro.estado}`);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="border-b border-outline-variant pb-4">
        <h1 className="text-2xl font-bold text-on-surface">{centro.nombre}</h1>

        <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
          <Icon name="location_on" className="text-[18px]" />
          {centro.ciudad}, {centro.estado}
        </p>
        <p className="mt-0.5 text-sm text-on-surface-variant">{centro.direccion}</p>

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

      <div className="grid grid-cols-3 gap-3">
        <Stat icon="inventory_2" valor={centro.necesidades.length} label={STATS.insumos} />
        <Stat icon="group" valor={centro.voluntarios} label={STATS.voluntarios} />
        <Stat icon="priority_high" valor={criticos} label={STATS.criticos} />
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emergency px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98]"
      >
        <Icon name="directions" />
        Cómo llegar
      </a>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Necesidades
        </h2>
        {centro.necesidades.length > 0 ? (
          <ul className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4">
            {centro.necesidades.map((n) => (
              <li
                key={`${n.nombre}-${n.nivel}`}
                className="flex items-center justify-between gap-3 border-b border-outline-variant py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-on-surface">{n.nombre}</p>
                  {n.categoria && (
                    <p className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <Icon
                        name={CATEGORIA_ICON[n.categoria] ?? CATEGORIA_ICON_FALLBACK}
                        className="text-[14px]"
                      />
                      {catLabel(n.categoria)}
                    </p>
                  )}
                  <p className="text-sm text-on-surface-variant">{n.cantidad} en stock</p>
                </div>
                <span
                  className={`shrink-0 rounded-badge px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${NIVEL_BADGE[n.nivel]}`}
                >
                  {NIVEL_LABEL[n.nivel]}
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
