"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { PAISES, PAIS_META, type Pais } from "@vnzl/paises";
import { Icon, Field, SelectField, TopAppBar } from "../_components";
import { apiFetch, getMe } from "../lib/api";
import { getToken } from "../lib/auth";
import { syncIdentity } from "../lib/identity";
import { paisPorTimezone, PAIS_POR_DEFECTO } from "../lib/pais";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
} from "../lib/validate";

type PerfilInput = { pais: Pais; nombre: string; cedula: string; telefono: string };

const OPCIONES_PAIS = PAISES.map((p) => ({
  value: p,
  label: `${PAIS_META[p].bandera} ${PAIS_META[p].label}`,
}));

export default function CompletarPerfilPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<PerfilInput>({
    mode: "onChange",
    defaultValues: { pais: PAIS_POR_DEFECTO, nombre: "", cedula: "", telefono: "" },
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
          // El país se preselecciona por zona horaria; acá (ya en el cliente)
          // Intl sí ve la del visitante.
          reset({
            pais: paisPorTimezone(),
            nombre: me?.nombre ?? "",
            cedula: "",
            telefono: "",
          });
        }
      } catch {
        /* ignore */
      }
      setReady(true);
    })();
  }, [router, reset]);

  const meta = PAIS_META[watch("pais")];

  async function onValid(values: PerfilInput) {
    setApiError(null);
    try {
      const res = await apiFetch("/usuarios/onboard", {
        method: "POST",
        body: JSON.stringify({
          pais: values.pais,
          nombre: values.nombre.trim(),
          cedula: normalizeCedula(values.pais, values.cedula),
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
              Necesitamos tu documento y teléfono para poder contribuir.
            </p>
          </div>

          {ready && (
            <form onSubmit={handleSubmit(onValid)} className="space-y-6">
              <div className="space-y-4">
                <SelectField
                  label="País"
                  icon="public"
                  options={OPCIONES_PAIS}
                  error={errors.pais?.message}
                  {...register("pais")}
                />
                <Field
                  label="Nombre completo"
                  icon="person"
                  placeholder="Ingresa tu nombre"
                  error={errors.nombre?.message}
                  {...register("nombre")}
                />
                <Field
                  label="Documento de identidad"
                  icon="badge"
                  placeholder={meta.ejemploDocumento}
                  error={errors.cedula?.message}
                  {...register("cedula")}
                />
                <Field
                  label="Teléfono"
                  icon="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder={meta.ejemploTelefono}
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
