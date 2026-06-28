"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../_components";
import { createCentro, type CreateCentroBody } from "../../../lib/api";
import { hasFullIdentity, syncIdentity } from "../../../lib/identity";
import { QK, ROUTES } from "../../../constants";
import { CentroForm, SuccessView } from "./_components";

export default function NuevoCentro() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"form" | "success">("form");
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

  // Geo del dispositivo al registrar (anti-fraude). Best-effort: si la deniegan o
  // tarda, se crea igual sin geo.
  function capturarGeo(): Promise<{ geoLat?: number; geoLng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ geoLat: pos.coords.latitude, geoLng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 8000, enableHighAccuracy: true },
      );
    });
  }

  async function onSubmit(body: CreateCentroBody) {
    setApiError(null);
    try {
      const geo = await capturarGeo();
      const res = await mutation.mutateAsync({ ...body, ...geo });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        setApiError(msg || "No se pudo registrar el centro. Inténtalo de nuevo.");
        return;
      }
      const created = await res.json().catch(() => null);
      setCreatedNombre(body.nombre);
      setCreatedId(created?.id ?? "");
      setScreen("success");
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

  if (screen === "success") {
    return (
      <div className="min-h-dvh bg-surface text-on-surface">
        <SuccessView
          centroNombre={createdNombre}
          onCargarInicial={() => router.push(ROUTES.cargarInventario(createdId))}
          onVerCentro={() => router.push(ROUTES.misCentros)}
          onInvitar={() => router.push(ROUTES.invitarVoluntarios(createdId))}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
        <h1 className="text-lg font-semibold text-on-surface">Nuevo Centro</h1>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="close" />
        </button>
      </header>

      <CentroForm
        defaultValues={{ nombre: "", ciudad: "", estado: "", direccion: "" }}
        description="Ingrese los detalles para registrar un nuevo centro de acopio y distribución de recursos en la zona afectada."
        submitLabel="Registrar Centro"
        pendingLabel="Registrando…"
        pending={mutation.isPending}
        apiError={apiError}
        onSubmit={onSubmit}
      />
    </div>
  );
}
