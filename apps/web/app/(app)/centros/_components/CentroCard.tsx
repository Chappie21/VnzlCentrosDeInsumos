import Link from "next/link";
import { Icon } from "../../../_components";
import { ROUTES } from "../../../constants";
import type { CentroCard as Centro } from "../../../_hooks";
import NeedBadge from "./NeedBadge";

export default function CentroCard({ centro }: { centro: Centro }) {
  return (
    <Link
      href={ROUTES.centroDetalle(centro.id)}
      className="relative block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-outline"
    >
      {centro.prioridadAlta && (
        <div className="absolute left-0 top-0 h-full w-1 bg-emergency" aria-hidden />
      )}

      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-xl font-semibold text-on-surface">
            <span className="truncate">{centro.nombre}</span>
            {centro.verificado && (
              <Icon
                name="verified"
                filled
                className="shrink-0 text-[18px] text-safety"
                aria-label="Centro verificado"
              />
            )}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
            <Icon name="location_on" className="text-[18px]" />
            {centro.direccion}
          </p>
        </div>
        {centro.distanciaKm != null && (
          <span className="shrink-0 rounded-lg bg-surface-container px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            A {centro.distanciaKm.toFixed(1)}km
          </span>
        )}
      </div>

      {centro.necesidades.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {centro.necesidades.map((n) => (
            <NeedBadge key={`${n.nombre}-${n.nivel}`} necesidad={n} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-4">
        {centro.recibiendoAhora ? (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emergency">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emergency" aria-hidden />
            Recibiendo ahora
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name="schedule" className="text-[16px]" />
            {centro.horarioCierre ? `Cierra a las ${centro.horarioCierre}` : "Cerrado"}
          </span>
        )}
        <Icon name="chevron_right" className="text-outline" />
      </div>
    </Link>
  );
}
