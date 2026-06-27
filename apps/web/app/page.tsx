"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "./_components/Icon";
import Field from "./_components/Field";
import { onboard } from "./lib/api";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
  type OnboardingErrors,
} from "./lib/validate";
import { setAnon, setIdentity } from "./lib/identity";

function OnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/centros";

  // "/" siempre muestra el formulario; el salto a /centros ocurre solo
  // tras "Entrar y Ayudar" o "Solo quiero observar".

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const liveErrors = validateOnboarding({ nombre, cedula, telefono });
  const hasErrors = Object.keys(liveErrors).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    const found = validateOnboarding({ nombre, cedula, telefono });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = {
      nombre: nombre.trim(),
      cedula: normalizeCedula(cedula),
      telefono: normalizeTelefono(telefono),
    };

    setSubmitting(true);
    try {
      const res = await onboard(body);
      if (!res.ok) {
        setApiError("No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      setIdentity(body);
      router.push(next);
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleObserve() {
    setAnon();
    router.push(next);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-50 mx-auto flex h-12 w-full max-w-[1024px] items-center justify-between border-b-2 border-outline-variant bg-surface px-4">
        <button
          type="button"
          aria-label="Menú"
          className="flex h-12 w-12 items-center justify-center rounded-full text-emergency transition-colors hover:bg-surface-container-high active:scale-95"
        >
          <Icon name="menu" />
        </button>
        <h1 className="text-xl font-bold uppercase tracking-tight text-emergency">
          RESPONSE CORE
        </h1>
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full text-emergency"
        >
          <Icon name="emergency" />
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-[1024px] flex-grow items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-md space-y-8 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-primary-container opacity-10"
          />

          <div className="space-y-2 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="healing" filled className="text-4xl" />
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">Ayuda de Emergencia</h2>
            <p className="text-base text-on-surface-variant">
              Completa tus datos para asistir o monitorear recursos vitales.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Field
                label="Nombre completo"
                icon="person"
                placeholder="Ingresa tu nombre"
                value={nombre}
                onChange={setNombre}
                error={errors.nombre}
              />
              <Field
                label="Cédula de identidad"
                icon="badge"
                placeholder="Ingresa tu cédula"
                value={cedula}
                onChange={setCedula}
                error={errors.cedula}
              />
              <Field
                label="Teléfono"
                icon="phone"
                type="tel"
                inputMode="tel"
                placeholder="Ingresa tu teléfono"
                value={telefono}
                onChange={setTelefono}
                error={errors.telefono}
              />
            </div>

            {apiError && <p className="text-sm text-emergency">{apiError}</p>}

            <div className="space-y-4 pt-2">
              <button
                type="submit"
                disabled={hasErrors || submitting}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="login" />
                {submitting ? "Entrando…" : "Entrar y Ayudar"}
              </button>

              <button
                type="button"
                onClick={handleObserve}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
              >
                <Icon name="visibility" />
                Solo quiero observar
              </button>
            </div>
          </form>

          <div className="flex items-center justify-center gap-2 border-t border-outline-variant pt-4">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Sistema Activo
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <OnboardingForm />
    </Suspense>
  );
}
