"use client";

import { useRouter } from "next/navigation";
import { EmptyState, Fab } from "../../_components";
import { useMisCentros } from "../../_hooks";
import { requireHelp } from "../../lib/identity";
import { ROUTES, SECCIONES } from "../../constants";
import type { MiCentro } from "../../lib/api";
import { MiCentroCard } from "./_components";

// Sección con título; se oculta si no hay centros.
function Seccion({ titulo, centros }: { titulo: string; centros: MiCentro[] }) {
  if (centros.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {titulo}
      </h2>
      {centros.map((c) => (
        <MiCentroCard key={c.id} centro={c} />
      ))}
    </section>
  );
}

export default function MisCentros() {
  const router = useRouter();
  const { data, isLoading, isError } = useMisCentros();

  const crear = () =>
    requireHelp(router, ROUTES.crearCentro, () => router.push(ROUTES.crearCentro));

  if (isLoading) {
    return <p className="py-8 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="No se pudieron cargar tus centros"
        subtitle="Revisá tu conexión e intentá de nuevo."
      />
    );
  }

  const centros = data ?? [];
  const duenio = centros.filter((c) => c.rol === "JEFE");
  const voluntario = centros.filter((c) => c.rol === "VOLUNTARIO");

  if (centros.length === 0) {
    return (
      <>
        <EmptyState
          icon="home_work"
          title="Todavía no tenés centros"
          subtitle="Creá un centro de acopio o sumate como voluntario a uno existente."
        />
        <Fab icon="add" label="Crear centro de acopio" onClick={crear} />
      </>
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-col gap-8">
        <Seccion titulo={SECCIONES.duenio} centros={duenio} />
        <Seccion titulo={SECCIONES.voluntario} centros={voluntario} />
      </div>
      <Fab icon="add" label="Crear centro de acopio" onClick={crear} />
    </>
  );
}
