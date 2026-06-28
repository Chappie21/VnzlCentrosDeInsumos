"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Field, TopAppBar } from "./_components";
import { ROUTES } from "./constants";
import { onboard } from "./lib/api";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
  type OnboardingInput,
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
      <TopAppBar />

      <main className="mx-auto flex w-full max-w-[1024px] flex-grow items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-md space-y-8 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-primary-container opacity-10"
          />
          {children}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1024px] px-4 pb-8 text-center text-sm text-on-surface-variant">
        <p>
          Hecho por:{" "}
          <a
            href="https://www.linkedin.com/in/andr%C3%A9s-chaparro/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary-container underline hover:no-underline"
          >
            Andres Chaparro
          </a>{" "}
          y{" "}
          <a
            href="https://www.linkedin.com/in/victor-atencio/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary-container underline hover:no-underline"
          >
            Victor Atencio
          </a>
        </p>
        <p className="mt-2 text-base font-medium">🇻🇪 Dios bendiga a Venezuela 🙏</p>
      </footer>
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
        <ProfileView
          identity={identity}
          onContinue={() => router.push(ROUTES.centros)}
          onDonate={() => router.push(ROUTES.donar)}
        />
      ) : (
        <OnboardingForm
          next={next}
          onDone={(id) => setIdentityState(id)}
          onDonate={() => router.push(ROUTES.donar)}
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
  onDonate,
}: {
  identity: Identity;
  onContinue: () => void;
  onDonate: () => void;
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

      <div className="space-y-3">
        <button
          type="button"
          onClick={onDonate}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98]"
        >
          <Icon name="volunteer_activism" />
          Quiero Donar
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
        >
          <Icon name="arrow_forward" />
          Continuar a centros
        </button>
      </div>

      <StatusFooter />
    </>
  );
}

function OnboardingForm({
  next,
  onDone,
  onDonate,
  onObserve,
}: {
  next: string;
  onDone: (id: Identity) => void;
  onDonate: () => void;
  onObserve: () => void;
}) {
  const [apiError, setApiError] = useState<string | null>(null);
  // Qué botón disparó el submit: ambos onboardean, pero divergen el destino.
  const intent = useRef<"help" | "donate">("help");

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<OnboardingInput>({
    mode: "onChange",
    defaultValues: { nombre: "", cedula: "", telefono: "" },
    // Reutiliza las mismas reglas que el backend mapeándolas al formato de RHF.
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

  async function onValid(values: OnboardingInput) {
    setApiError(null);

    const body = {
      nombre: values.nombre.trim(),
      cedula: normalizeCedula(values.cedula),
      telefono: normalizeTelefono(values.telefono),
    };

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
      if (intent.current === "donate") onDonate();
      else onDone(body); // queda autenticado: la vista pasa a perfil
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
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

        <div className="space-y-4 pt-2">
          <button
            type="submit"
            onClick={() => (intent.current = "donate")}
            disabled={!isValid || isSubmitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="volunteer_activism" />
            Quiero Donar
          </button>

          <button
            type="submit"
            onClick={() => (intent.current = "help")}
            disabled={!isValid || isSubmitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="login" />
            {isSubmitting ? "Entrando…" : "Entrar y Ayudar"}
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
