import Link from "next/link";
import { Icon } from "../../../../_components";
import { ROUTES } from "../../../../constants";
import type { CentroDetalle } from "../../../../lib/api";

// Encabezado del dashboard: nombre, ubicación y estado. El lápiz de editar los
// datos principales solo aparece para el JEFE (el server lo refuerza con JefeGuard).
export default function DetalleHeader({ centro }: { centro: CentroDetalle }) {
  const esJefe = centro.rol === "JEFE";
  return (
    <header className="border-b border-outline-variant pb-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-on-surface">{centro.nombre}</h1>
        {esJefe && (
          <Link
            href={ROUTES.misCentroEditar(centro.id)}
            aria-label="Editar datos del centro"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="edit" />
          </Link>
        )}
      </div>

      <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
        <Icon name="location_on" className="text-[18px]" />
        {centro.ciudad}, {centro.estado}
      </p>
      <p className="mt-0.5 text-sm text-on-surface-variant">{centro.direccion}</p>

      {centro.recibiendoAhora ? (
        <span className="mt-3 inline-flex items-center gap-1 rounded-badge bg-emergency/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emergency">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emergency" aria-hidden />
          Activo
        </span>
      ) : (
        <span className="mt-3 inline-flex items-center gap-1 rounded-badge bg-surface-container px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          <Icon name="schedule" className="text-[14px]" />
          {centro.horarioCierre ? `Cierra ${centro.horarioCierre}` : "Cerrado"}
        </span>
      )}
    </header>
  );
}
