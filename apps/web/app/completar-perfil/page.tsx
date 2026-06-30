"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Icon, Field, TopAppBar } from "../_components";
import { apiFetch, getMe } from "../lib/api";
import { getToken } from "../lib/auth";
import { syncIdentity } from "../lib/identity";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
} from "../lib/validate";

type PerfilInput = { nombre: string; cedula: string; telefono: string };

export default function CompletarPerfilPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<PerfilInput>({
    mode: "onChange",
    defaultValues: { nombre: "", cedula: "", telefono: "" },
    resolver: (values) => {
      const fieldErrors = validateOnboarding(values);
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

  // Sin sesión no tiene sentido; con sesión prellenamos el nombre que vino de Google.
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        router.replace("/login");
        return;
      }
      try {
        const res = await getMe();
        if (res.ok) {
          const me = await res.json();
          if (me?.identidadCompleta) {
            router.replace("/");
            return;
          }
          reset({ nombre: me?.nombre ?? "", cedula: "", telefono: "" });
        }
      } catch {
        /* ignore */
      }
      setReady(true);
    })();
  }, [router, reset]);

  async function onValid(values: PerfilInput) {
    setApiError(null);
    try {
      const res = await apiFetch("/usuarios/onboard", {
        method: "POST",
        body: JSON.stringify({
          nombre: values.nombre.trim(),
          cedula: normalizeCedula(values.cedula),
          telefono: normalizeTelefono(values.telefono),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        setApiError(msg || "No se pudo guardar.");
        return;
      }
      await syncIdentity();
      router.push("/");
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <TopAppBar />
      <main className="mx-auto flex w-full max-w-[1024px] flex-grow items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="space-y-2 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="badge" filled className="text-4xl" />
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">Completa tu perfil</h2>
            <p className="text-base text-on-surface-variant">
              Necesitamos tu cédula y teléfono para poder contribuir.
            </p>
          </div>

          {ready && (
            <form onSubmit={handleSubmit(onValid)} className="space-y-6">
              <div className="space-y-4">
                <Field
                  label="Nombre completo"
                  icon="person"
                  placeholder="Ingresa tu nombre"
                  error={errors.nombre?.message}
                  {...register("nombre")}
                />
                <Field
                  label="Cédula de identidad"
                  icon="badge"
                  placeholder="V12345678"
                  error={errors.cedula?.message}
                  {...register("cedula")}
                />
                <Field
                  label="Teléfono"
                  icon="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="04141234567"
                  error={errors.telefono?.message}
                  {...register("telefono")}
                />
              </div>

              {apiError && <p className="text-sm text-emergency">{apiError}</p>}

              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="check" />
                {isSubmitting ? "Guardando…" : "Guardar y continuar"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
