"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, Icon } from "../../../../_components";
import { DEBOUNCE_MS, ROUTES, VOLUNTARIOS } from "../../../../constants";
import { useCentroDetalle, useDebouncedValue, useVoluntarios } from "../../../../_hooks";
import { VoluntarioCard } from "./_components";

// Gestión de voluntarios: solo el JEFE (el server lo refuerza con JefeGuard). Lista
// a los miembros con su contacto, permite buscarlos y removerlos, y atajo a invitar.
export default function VoluntariosPage() {
  const { centroId } = useParams<{ centroId: string }>();
  // El rol sale del detalle (ya cacheado) para el gate de UI.
  const detalle = useCentroDetalle(centroId);
  const { data, isLoading, isError } = useVoluntarios(centroId);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, DEBOUNCE_MS);

  const filtrados = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term || !data) return data ?? [];
    return data.filter((v) =>
      [v.nombre, v.telefono, v.cedula].some((campo) => campo?.toLowerCase().includes(term)),
    );
  }, [data, debouncedQ]);

  // Gate de rol: si el detalle ya cargó y no es JEFE, no mostramos la gestión.
  if (detalle.data && detalle.data.rol !== "JEFE") {
    return (
      <EmptyState
        icon="lock"
        title={VOLUNTARIOS.soloJefeTitulo}
        subtitle={VOLUNTARIOS.soloJefeSubtitulo}
      />
    );
  }

  if (isLoading) {
    return <p className="py-8 text-center text-on-surface-variant">{VOLUNTARIOS.cargando}</p>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon="error"
        title={VOLUNTARIOS.errorTitulo}
        subtitle={VOLUNTARIOS.errorSubtitulo}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">{VOLUNTARIOS.titulo}</h1>
        <p className="text-on-surface-variant">{VOLUNTARIOS.subtitulo(data.length)}</p>
      </header>

      <label className="flex h-12 items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface-variant focus-within:border-on-surface">
        <Icon name="search" className="text-[20px]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={VOLUNTARIOS.buscar}
          aria-label={VOLUNTARIOS.buscar}
          className="min-w-0 flex-1 bg-transparent text-on-surface outline-none"
        />
      </label>

      <Link
        href={ROUTES.invitarVoluntarios(centroId)}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
      >
        <Icon name="group_add" />
        {VOLUNTARIOS.invitar}
      </Link>

      {data.length === 0 ? (
        <EmptyState
          icon="groups"
          title={VOLUNTARIOS.vacioTitulo}
          subtitle={VOLUNTARIOS.vacioSubtitulo}
        />
      ) : filtrados.length === 0 ? (
        <p className="py-8 text-center text-on-surface-variant">{VOLUNTARIOS.sinResultados}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrados.map((v) => (
            <VoluntarioCard key={v.id} centroId={centroId} voluntario={v} />
          ))}
        </ul>
      )}
    </div>
  );
}
