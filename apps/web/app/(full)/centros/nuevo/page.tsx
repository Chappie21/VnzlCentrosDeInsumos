"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Field, Icon, TextAreaField } from "../../../_components";
import { useGeolocation } from "../../../_hooks";
import { createCentro } from "../../../lib/api";
import { hasFullIdentity, syncIdentity } from "../../../lib/identity";
import { validateCentro, type CentroInput } from "../../../lib/validate";
import { QK, ROUTES } from "../../../constants";
import { GeolocationCard, SuccessView } from "./_components";

const fmt = (n: number) => n.toFixed(6);

export default function NuevoCentro() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"form" | "success">("form");
  const [createdNombre, setCreatedNombre] = useState("");
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

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<CentroInput>({
    mode: "onChange",
    defaultValues: { nombre: "", ciudad: "", estado: "", direccion: "" },
    // Reutiliza las mismas reglas que el backend mapeándolas al formato de RHF.
    resolver: (values) => {
      const fieldErrors = validateCentro(values);
      const hasErrors = Object.keys(fieldErrors).length > 0;
      return {
        values: hasErrors ? {} : values,
        errors: Object.fromEntries(
          Object.entries(fieldErrors).map(([name, message]) => [
            name,
            { type: "validate", message },
          ]),
        ),
      };
    },
  });

  const { coords, denied, request } = useGeolocation();

  useEffect(() => {
    if (!coords) return;
    setValue("latitud", coords.lat, { shouldValidate: true });
    setValue("longitud", coords.lng, { shouldValidate: true });
  }, [coords, setValue]);

  const mutation = useMutation({
    mutationFn: createCentro,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QK.centros] });
    },
  });

  async function onValid(values: CentroInput) {
    setApiError(null);

    const body = {
      nombre: values.nombre.trim(),
      ciudad: values.ciudad.trim(),
      estado: values.estado.trim(),
      direccion: values.direccion.trim(),
      ...(coords ? { latitud: coords.lat, longitud: coords.lng } : {}),
    };

    try {
      const res = await mutation.mutateAsync(body);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message)
          ? data.message.join(" ")
          : data?.message;
        setApiError(msg || "No se pudo registrar el centro. Inténtalo de nuevo.");
        return;
      }
      setCreatedNombre(body.nombre);
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
          onVerCentro={() => router.push(ROUTES.miCentro)}
          // ponytail: invitar ayudantes aún no existe; no-op hasta que haya flujo.
          onInvitar={() => {}}
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

      <form
        onSubmit={handleSubmit(onValid)}
        className="mx-auto flex w-full max-w-md flex-grow flex-col"
      >
        <div className="flex-grow space-y-6 px-4 py-6">
          <p className="text-base text-on-surface-variant">
            Ingrese los detalles para registrar un nuevo centro de acopio y
            distribución de recursos en la zona afectada.
          </p>

          <Field
            label="Nombre del Centro"
            icon="store"
            placeholder="Ej. Centro Deportivo Municipal"
            error={errors.nombre?.message}
            {...register("nombre")}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Ciudad"
              icon="location_city"
              placeholder="Ciudad"
              error={errors.ciudad?.message}
              {...register("ciudad")}
            />
            <Field
              label="Estado / Provincia"
              icon="map"
              placeholder="Estado"
              error={errors.estado?.message}
              {...register("estado")}
            />
          </div>

          <TextAreaField
            label="Dirección Completa"
            placeholder="Calle, Número, Colonia, C.P."
            error={errors.direccion?.message}
            {...register("direccion")}
          />

          <GeolocationCard
            coords={coords}
            denied={denied}
            onRequest={request}
            lat={coords ? fmt(coords.lat) : ""}
            lng={coords ? fmt(coords.lng) : ""}
          />

          {apiError && <p className="text-sm text-emergency">{apiError}</p>}
        </div>

        <div className="sticky bottom-0 border-t border-outline-variant bg-surface px-4 py-4">
          <button
            type="submit"
            disabled={!isValid || mutation.isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="check" />
            {mutation.isPending ? "Registrando…" : "Registrar Centro"}
          </button>
        </div>
      </form>
    </div>
  );
}
