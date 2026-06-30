"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./_components";
import { AuthShell, StatusFooter } from "./_components/AuthShell";
import { ROUTES } from "./constants";
import {
  getIdentity,
  hasFullIdentity,
  syncIdentity,
  type Identity,
} from "./lib/identity";
import { clearToken } from "./lib/auth";

function Home() {
  const router = useRouter();

  // Resolver identidad al montar: cache local primero, luego backend (vía JWT).
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
      <AuthShell>
        <p className="py-8 text-center text-on-surface-variant">Cargando…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {identity ? (
        <ProfileView
          identity={identity}
          onContinue={() => router.push(ROUTES.misCentros)}
          onDonate={() => router.push(ROUTES.donar)}
          onLogout={() => {
            clearToken();
            setIdentityState(null);
          }}
        />
      ) : (
        <IntentScreen />
      )}
    </AuthShell>
  );
}

// Pantalla de intención: qué querés hacer. Solo "Administrar" pide login.
function IntentScreen() {
  return (
    <>
      <div className="space-y-2 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="favorite" filled className="text-4xl" />
        </div>
        <h2 className="text-2xl font-semibold text-on-surface">¿Qué quieres hacer?</h2>
        <p className="text-base text-on-surface-variant">
          Donar y buscar centros no requieren cuenta.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href={ROUTES.donar}
          className="flex h-16 w-full items-center gap-3 rounded-lg bg-action px-4 font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98]"
        >
          <Icon name="volunteer_activism" className="text-2xl" />
          <span className="flex flex-col items-start leading-tight">
            Quiero donar
            <span className="text-xs font-normal text-white/80">Arma tu donación y genera un QR</span>
          </span>
        </Link>

        <Link
          href={ROUTES.centros}
          className="flex h-16 w-full items-center gap-3 rounded-lg bg-primary-container px-4 font-semibold text-on-primary-container shadow-sm transition-colors hover:brightness-95 active:scale-[0.98]"
        >
          <Icon name="search" className="text-2xl" />
          <span className="flex flex-col items-start leading-tight">
            Buscar un centro de acopio
            <span className="text-xs font-normal opacity-80">Directorio y mapa de centros</span>
          </span>
        </Link>

        <Link
          href={ROUTES.login}
          className="flex h-16 w-full items-center gap-3 rounded-lg border border-outline-variant bg-surface-container px-4 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
        >
          <Icon name="store" className="text-2xl" />
          <span className="flex flex-col items-start leading-tight">
            Administrar un centro / Soy voluntario
            <span className="text-xs font-normal opacity-80">Requiere iniciar sesión</span>
          </span>
        </Link>
      </div>

      <StatusFooter />
    </>
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
        <p className="text-base text-on-surface-variant">Tu sesión está activa.</p>
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
          onClick={onContinue}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98]"
        >
          <Icon name="store" />
          Mis centros
        </button>
        <button
          type="button"
          onClick={onDonate}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
        >
          <Icon name="volunteer_activism" />
          Quiero Donar
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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
