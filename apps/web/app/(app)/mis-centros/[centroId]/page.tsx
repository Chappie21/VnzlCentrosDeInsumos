"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "../../../_components";
import { useCentroDetalle } from "../../../_hooks";
import {
  DetalleHeader,
  StatsRow,
  OperativoToggle,
  InventarioResumen,
} from "./_components";

// Dashboard de un centro: solo miembros (el server lo refuerza con VoluntarioGuard).
export default function CentroDetallePage() {
  const params = useParams<{ centroId: string }>();
  const { data, isLoading, isError } = useCentroDetalle(params.centroId);

  if (isLoading) {
    return <p className="py-8 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon="error"
        title="No se pudo cargar el centro"
        subtitle="Puede que no seas miembro o que haya un problema de conexión."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <DetalleHeader centro={data} />
      <StatsRow centro={data} />
      <OperativoToggle centro={data} />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Resumen de inventario
        </h2>
        <InventarioResumen insumos={data.insumos} />
      </section>
    </div>
  );
}
