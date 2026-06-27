"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../../_components";
import { useCentroDetalle } from "../../../../_hooks";
import type { Coords } from "../../../../_hooks";
import { updateCentro, type CreateCentroBody } from "../../../../lib/api";
import { QK, ROUTES } from "../../../../constants";
import { CentroForm } from "../../../centros/nuevo/_components";

export default function EditarCentro() {
  const params = useParams<{ centroId: string }>();
  const id = params.centroId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useCentroDetalle(id);
  const [apiError, setApiError] = useState<string | null>(null);

  // Gate de UX: solo el JEFE edita los datos principales. El server lo refuerza
  // con JefeGuard (defensa en profundidad).
  useEffect(() => {
    if (data && data.rol !== "JEFE") router.replace(ROUTES.misCentroDetalle(id));
  }, [data, id, router]);

  const mutation = useMutation({
    mutationFn: (body: CreateCentroBody) => updateCentro(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QK.centros] }),
  });

  async function onSubmit(body: CreateCentroBody) {
    setApiError(null);
    try {
      const res = await mutation.mutateAsync(body);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        const msg = Array.isArray(d?.message) ? d.message.join(" ") : d?.message;
        setApiError(msg || "No se pudieron guardar los cambios.");
        return;
      }
      router.push(ROUTES.misCentroDetalle(id));
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">
        <p className="text-on-surface-variant">Cargando…</p>
      </div>
    );
  }

  // Sin acceso o error: no renderizamos el form (el efecto ya redirige al detalle).
  if (isError || !data || data.rol !== "JEFE") return null;

  const initialPoint: Coords | null =
    data.latitud != null && data.longitud != null
      ? { lat: data.latitud, lng: data.longitud }
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
        <h1 className="text-lg font-semibold text-on-surface">Editar Centro</h1>
        <button
          type="button"
          onClick={() => router.push(ROUTES.misCentroDetalle(id))}
          aria-label="Cerrar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="close" />
        </button>
      </header>

      <CentroForm
        defaultValues={{
          nombre: data.nombre,
          ciudad: data.ciudad,
          estado: data.estado,
          direccion: data.direccion,
          ...(initialPoint ? { latitud: initialPoint.lat, longitud: initialPoint.lng } : {}),
        }}
        initialPoint={initialPoint}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
        pending={mutation.isPending}
        apiError={apiError}
        validateOnMount
        onSubmit={onSubmit}
      />
    </div>
  );
}
