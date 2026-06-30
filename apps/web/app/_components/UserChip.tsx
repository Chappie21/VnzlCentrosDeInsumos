"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { ROUTES } from "../constants";
import { getIdentity, hasFullIdentity, syncIdentity, type Identity } from "../lib/identity";
import { clearToken } from "../lib/auth";

// Iniciales: primera letra del primer y último nombre/apellido.
function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  const a = p[0][0] ?? "";
  const b = p.length > 1 ? p[p.length - 1][0] : "";
  return (a + b).toUpperCase();
}

// Muestra quién está logueado (avatar + nombre) con menú. Si no hay sesión,
// ofrece "Entrar". Vive en la TopAppBar (header global).
export default function UserChip() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasFullIdentity()) {
      setIdentity(getIdentity());
      return;
    }
    void syncIdentity().then(setIdentity);
  }, []);

  if (!identity) {
    return (
      <Link
        href={ROUTES.login}
        className="flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
      >
        <Icon name="login" className="text-[18px]" />
        Entrar
      </Link>
    );
  }

  const primerNombre = identity.nombre.split(" ")[0];

  function logout() {
    clearToken();
    // recarga completa: resetea cualquier estado de identidad cacheado en la app
    window.location.assign(ROUTES.home);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 max-w-[10rem] items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-container-high active:scale-95"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
          {iniciales(identity.nombre)}
        </span>
        <span className="hidden truncate text-sm font-semibold text-on-surface sm:inline">
          {primerNombre}
        </span>
        <Icon name="expand_more" className="hidden text-[18px] text-on-surface-variant sm:inline" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-11 z-50 min-w-56 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
            <div className="border-b border-outline-variant px-4 py-3">
              <p className="truncate text-sm font-semibold text-on-surface">{identity.nombre}</p>
              <p className="truncate text-xs text-on-surface-variant">{identity.cedula}</p>
            </div>
            <Link
              href={ROUTES.misCentros}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-on-surface hover:bg-surface-container-high"
            >
              <Icon name="store" />
              Mis centros
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-emergency hover:bg-surface-container-high"
            >
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
