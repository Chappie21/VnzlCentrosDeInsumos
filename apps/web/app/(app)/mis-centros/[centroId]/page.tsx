"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, Icon } from "../../../_components";
import { ROUTES } from "../../../constants";
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
      {/* Gestión + invitación de voluntarios: solo el JEFE (el server lo refuerza
          con JefeGuard). */}
      {data.rol === "JEFE" && (
        <div className="flex flex-col gap-3">
          <Link
            href={ROUTES.gestionarVoluntarios(data.id)}
            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="groups" />
            Gestionar voluntarios
          </Link>
          <Link
            href={ROUTES.invitarVoluntarios(data.id)}
            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="group_add" />
            Invitar voluntarios
          </Link>
          <Link
            href={ROUTES.reporteInventario(data.id)}
            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="picture_as_pdf" />
            Descargar reporte PDF
          </Link>
        </div>
      )}
      <OperativoToggle centro={data} />

      {/* Acciones del centro: recibir (escaneo, entrante) y despachar (envío, saliente). */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={ROUTES.escanearDonacion(data.id)}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#3d6649] active:scale-[0.98]"
        >
          <Icon name="qr_code_scanner" />
          Escanear donación
        </Link>
        <Link
          href={ROUTES.nuevoEnvio(data.id)}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#9a2a28] active:scale-[0.98]"
        >
          <Icon name="local_shipping" />
          Nuevo Envío
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Resumen de inventario
        </h2>
        <InventarioResumen insumos={data.insumos} rol={data.rol} centroId={data.id} />
      </section>
    </div>
  );
}
