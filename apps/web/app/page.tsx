"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon, Field, TopAppBar } from "./_components";
import { GoogleButton } from "./_components/GoogleButton";
import { ROUTES } from "./constants";
import { login } from "./lib/authApi";
import { normalizeCedula } from "./lib/validate";
import {
  getIdentity,
  hasFullIdentity,
  setAnon,
  setIdentity,
  syncIdentity,
  type Identity,
} from "./lib/identity";
import { clearToken } from "./lib/auth";

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

      <footer className="mx-auto w-full max-w-[1024px] px-4 pb-4 text-center text-sm text-on-surface-variant">
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
        <p className="mt-1">
          Iniciativa por{" "}
          <a
            href="https://build4venezuela.com/es"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary-container underline hover:no-underline"
          >
            Build4Venezuela
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

  // Resolver identidad al montar: cache local primero, luego backend (rehidrata vía JWT).
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
          onLogout={() => {
            clearToken();
            setIdentityState(null);
          }}
        />
      ) : (
        <LoginForm
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
  onLogout,
}: {
  identity: Identity;
  onContinue: () => void;
  onDonate: () => void;
  onLogout: () => void;
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
          Tu sesión está activa. Puedes usar tu cuenta en cualquier dispositivo.
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
        <button
          type="button"
          onClick={onLogout}
          className="w-full text-center text-sm text-on-surface-variant underline hover:no-underline"
        >
          Cerrar sesión
        </button>
      </div>

      <StatusFooter />
    </>
  );
}

type LoginInput = { cedula: string; password: string };

function LoginForm({
  onDone,
  onDonate,
  onObserve,
}: {
  onDone: (id: Identity) => void;
  onDonate: () => void;
  onObserve: () => void;
}) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    mode: "onChange",
    defaultValues: { cedula: "", password: "" },
  });

  async function onValid(values: LoginInput) {
    setApiError(null);
    try {
      const { usuario } = await login(normalizeCedula(values.cedula), values.password);
      if (usuario.nombre && usuario.cedula && usuario.telefono) {
        const id: Identity = {
          nombre: usuario.nombre,
          cedula: usuario.cedula,
          telefono: usuario.telefono,
        };
        setIdentity(id);
        onDone(id);
      } else {
        // Cuenta sin perfil completo (caso borde) → rehidratar igual.
        const id = await syncIdentity();
        if (id) onDone(id);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Cédula o contraseña inválida");
    }
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="login" filled className="text-4xl" />
        </div>
        <h2 className="text-2xl font-semibold text-on-surface">Iniciar sesión</h2>
        <p className="text-base text-on-surface-variant">
          Ingresa con tu cédula y contraseña para ayudar o donar.
        </p>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-6">
        <div className="space-y-4">
          <Field
            label="Cédula de identidad"
            icon="badge"
            placeholder="V12345678"
            error={errors.cedula?.message}
            {...register("cedula", { required: "Ingresa tu cédula" })}
          />
          <Field
            label="Contraseña"
            icon="lock"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password", { required: "Ingresa tu contraseña" })}
          />
        </div>

        {apiError && <p className="text-sm text-emergency">{apiError}</p>}

        <div className="space-y-4 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="login" />
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>

          <GoogleButton />

          <p className="text-center text-sm text-on-surface-variant">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-primary-container underline hover:no-underline">
              Regístrate
            </Link>
          </p>

          {/* Acciones sin cuenta: donar y observar no requieren autenticación. */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-outline-variant" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-container-lowest px-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Sin cuenta
              </span>
            </div>
          </div>

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
