import { Icon } from "../../../_components";
import { ROL_LABEL } from "../../../constants";
import type { MiCentro } from "../../../lib/api";

// Tarjeta de un centro propio: rol, ubicación, voluntarios, insumos y estado.
export default function MiCentroCard({ centro }: { centro: MiCentro }) {
  const esJefe = centro.rol === "JEFE";
  return (
    // ponytail: la ruta de detalle aún no existe; tarjeta no clickeable por ahora.
    <article className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-on-surface">{centro.nombre}</h2>
          <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
            <Icon name="location_on" className="text-[18px]" />
            {centro.ciudad}, {centro.estado}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-badge px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
            esJefe
              ? "bg-primary-container text-on-primary-container"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {ROL_LABEL[centro.rol]}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-on-surface-variant">
        <span className="flex items-center gap-1">
          <Icon name="group" className="text-[16px]" />
          {centro.voluntarios}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="inventory_2" className="text-[16px]" />
          {centro.insumos.length}
        </span>
      </div>

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
    </article>
  );
}
