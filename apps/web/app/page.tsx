"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "./_components/Icon";
import Field from "./_components/Field";
import { onboard } from "./lib/api";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
} from "./lib/validate";
import {
  getIdentity,
  hasFullIdentity,
  setAnon,
  setIdentity,
  syncIdentity,
  type Identity,
} from "./lib/identity";

function Shell({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </main>
    </div>
  );
}

function StatusFooter() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-outline-variant pt-4">
      <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        Sistema Activo
      </span>
    </div>
  );
}

function Home() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/centros";

  // Resolver identidad al montar: localStorage primero, luego backend (rehidrata).
  const [loading, setLoading] = useState(true);
  const [identity, setIdentityState] = useState<Identity | null>(null);

  useEffect(() => {
    (async () => {
      if (hasFullIdentity()) {
        setIdentityState(getIdentity());
        setLoading(false);
        return;
      }
      setIdentityState(await syncIdentity());
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Shell>
        <p className="py-8 text-center text-on-surface-variant">Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      {identity ? (
        <ProfileView identity={identity} onContinue={() => router.push("/centros")} />
      ) : (
        <OnboardingForm
          next={next}
          onDone={(id) => setIdentityState(id)}
          onObserve={() => {
            setAnon();
            router.push(next);
          }}
        />
      )}
    </Shell>
  );
}

function ProfileView({
  identity,
  onContinue,
}: {
  identity: Identity;
  onContinue: () => void;
}) {
  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "person", label: "Nombre completo", value: identity.nombre },
    { icon: "badge", label: "Cédula de identidad", value: identity.cedula },
    { icon: "phone", label: "Teléfono", value: identity.telefono },
  ];
  return (
    <>
      <div className="space-y-2 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="verified_user" filled className="text-4xl" />
        </div>
        <h2 className="text-2xl font-semibold text-on-surface">
          Hola, {identity.nombre.split(" ")[0]}
        </h2>
        <p className="text-base text-on-surface-variant">
          Tu identidad está registrada en este dispositivo.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 py-3"
          >
            <span className="text-on-surface-variant">
              <Icon name={r.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {r.label}
              </p>
              <p className="truncate text-base text-on-surface">{r.value}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98]"
      >
        <Icon name="arrow_forward" />
        Continuar a centros
      </button>

      <StatusFooter />
    </>
  );
}

function OnboardingForm({
  next,
  onDone,
  onObserve,
}: {
  next: string;
  onDone: (id: Identity) => void;
  onObserve: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const errors = validateOnboarding({ nombre, cedula, telefono });
  const hasErrors = Object.keys(errors).length > 0;

  // Error visible solo si el campo fue tocado (tiene texto) o ya se intentó enviar.
  const show = (field: keyof typeof errors, value: string) =>
    submitted || value.length > 0 ? errors[field] : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setApiError(null);
    if (hasErrors) return;

    const body = {
      nombre: nombre.trim(),
      cedula: normalizeCedula(cedula),
      telefono: normalizeTelefono(telefono),
    };

    setSubmitting(true);
    try {
      const res = await onboard(body);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message)
          ? data.message.join(" ")
          : data?.message;
        setApiError(msg || "No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      setIdentity(body);
      onDone(body); // queda autenticado: la vista pasa a perfil
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
            error={show("nombre", nombre)}
          />
          <Field
            label="Cédula de identidad"
            icon="badge"
            placeholder="V12345678"
            value={cedula}
            onChange={setCedula}
            error={show("cedula", cedula)}
          />
          <Field
            label="Teléfono"
            icon="phone"
            type="tel"
            inputMode="tel"
            placeholder="04141234567"
            value={telefono}
            onChange={setTelefono}
            error={show("telefono", telefono)}
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
            onClick={onObserve}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
          >
            <Icon name="visibility" />
            Solo quiero observar
          </button>
        </div>
      </form>

      <StatusFooter />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
