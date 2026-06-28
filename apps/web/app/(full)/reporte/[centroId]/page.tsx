"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, Icon } from "../../../_components";
import { ROUTES } from "../../../constants";
import { useCentroDetalle, useVoluntarios } from "../../../_hooks";
import { ReporteInventario } from "./_components";

// Reporte imprimible del inventario de un centro (solo JEFE). El endpoint de
// voluntarios es JEFE-only: si responde 403 mostramos el error.
export default function ReportePage() {
  const params = useParams<{ centroId: string }>();
  // Instante de revisión capturado una sola vez (estable entre re-renders).
  const [instante] = useState(() => new Date());

  const detalle = useCentroDetalle(params.centroId);
  const voluntarios = useVoluntarios(params.centroId);

  if (detalle.isLoading || voluntarios.isLoading) {
    return <p className="py-8 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (detalle.isError || !detalle.data || voluntarios.isError || !voluntarios.data) {
    return (
      <EmptyState
        icon="error"
        title="No se pudo generar el reporte"
        subtitle="El reporte es solo para el JEFE del centro."
      />
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      {/* Barra de acciones: oculta al imprimir. */}
      <div className="flex items-center justify-between gap-3 p-4 print:hidden">
        <Link
          href={ROUTES.misCentroDetalle(detalle.data.id)}
          className="flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="arrow_back" />
          Volver
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-safety px-4 font-semibold text-white shadow-sm transition-colors hover:bg-[#3d6649] active:scale-[0.98]"
        >
          <Icon name="picture_as_pdf" />
          Descargar PDF
        </button>
      </div>

      <ReporteInventario
        centro={detalle.data}
        voluntarios={voluntarios.data}
        instante={instante}
      />
    </div>
  );
}
