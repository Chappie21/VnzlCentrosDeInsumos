"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../_components";
import { createCentro, type CreateCentroBody, type InsumoInicial } from "../../../lib/api";
import { hasFullIdentity, syncIdentity } from "../../../lib/identity";
import { QK, ROUTES } from "../../../constants";
import { CentroForm, InventarioInicialForm, SuccessView } from "./_components";

export default function NuevoCentro() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  // Flujo de 2 pasos: datos del centro → inventario inicial → éxito.
  const [paso, setPaso] = useState<"datos" | "inventario" | "success">("datos");
  const [datos, setDatos] = useState<CreateCentroBody | null>(null);
  const [createdNombre, setCreatedNombre] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);

  // Auth gate: requiere identidad completa; si no, vuelve a onboarding con `next`.
  useEffect(() => {
    (async () => {
      const ok = hasFullIdentity() || (await syncIdentity()) != null;
      if (!ok) {
        router.replace(`/?next=${encodeURIComponent(ROUTES.crearCentro)}`);
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  const mutation = useMutation({
    mutationFn: createCentro,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QK.centros] });
    },
  });

  // Paso 1: guarda los datos y avanza al inventario inicial.
  function onDatos(body: CreateCentroBody) {
    setApiError(null);
    setDatos(body);
    setPaso("inventario");
  }

  // Paso 2: un único request con datos + insumos (carga inicial atómica).
  async function onConfirmInventario(insumos: InsumoInicial[]) {
    if (!datos) return;
    setApiError(null);
    try {
      const body = { ...datos, ...(insumos.length ? { insumos } : {}) };
      const res = await mutation.mutateAsync(body);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        setApiError(msg || "No se pudo registrar el centro. Inténtalo de nuevo.");
        return;
      }
      const created = await res.json().catch(() => null);
      setCreatedNombre(datos.nombre);
      setCreatedId(created?.id ?? "");
      setPaso("success");
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">
        <p className="text-on-surface-variant">Cargando…</p>
      </div>
    );
  }

  if (paso === "success") {
    return (
      <div className="min-h-dvh bg-surface text-on-surface">
        <SuccessView
          centroNombre={createdNombre}
          onVerCentro={() => router.push(ROUTES.misCentros)}
          onInvitar={() => router.push(ROUTES.invitarVoluntarios(createdId))}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
        <h1 className="text-lg font-semibold text-on-surface">
          {paso === "inventario" ? "Inventario inicial" : "Nuevo Centro"}
        </h1>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="close" />
        </button>
      </header>

      {paso === "datos" ? (
        <CentroForm
          // Precarga lo ya ingresado al volver del paso 2.
          defaultValues={
            datos
              ? { nombre: datos.nombre, ciudad: datos.ciudad, estado: datos.estado, direccion: datos.direccion }
              : { nombre: "", ciudad: "", estado: "", direccion: "" }
          }
          initialPoint={
            datos?.latitud != null && datos?.longitud != null
              ? { lat: datos.latitud, lng: datos.longitud }
              : null
          }
          validateOnMount={datos != null}
          description="Ingrese los detalles para registrar un nuevo centro de acopio y distribución de recursos en la zona afectada."
          submitLabel="Continuar"
          pendingLabel="Continuar"
          pending={false}
          apiError={apiError}
          onSubmit={onDatos}
        />
      ) : (
        <InventarioInicialForm
          onSubmit={onConfirmInventario}
          onBack={() => setPaso("datos")}
          pending={mutation.isPending}
          apiError={apiError}
        />
      )}
    </div>
  );
}
