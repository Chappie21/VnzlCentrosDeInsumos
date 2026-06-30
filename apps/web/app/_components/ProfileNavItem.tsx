"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { ROUTES } from "../constants";
import { getIdentity, hasFullIdentity, syncIdentity, type Identity } from "../lib/identity";
import { clearToken } from "../lib/auth";

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  const a = p[0][0] ?? "";
  const b = p.length > 1 ? p[p.length - 1][0] : "";
  return (a + b).toUpperCase();
}

const ITEM = "flex h-full w-full flex-col items-center justify-center gap-1 transition-all active:scale-90";

// Ítem de BottomNav: avatar + "Perfil" con un popover de mini-perfil (nombre,
// cédula, ayuda, cerrar sesión). Sin sesión, es un acceso "Entrar" → /login.
export default function ProfileNavItem() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasFullIdentity()) setIdentity(getIdentity());
    else void syncIdentity().then(setIdentity);
  }, []);

  if (!identity) {
    return (
      <Link href={ROUTES.login} className={`${ITEM} text-on-surface-variant hover:bg-surface-container-high`}>
        <Icon name="login" />
        <span className="text-[11px] font-bold uppercase tracking-wider">Entrar</span>
      </Link>
    );
  }

  function logout() {
    clearToken();
    window.location.assign(ROUTES.home); // recarga: resetea estado de identidad
  }

  return (
    <div className="relative flex h-full w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${ITEM} ${open ? "rounded-xl bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high"}`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-on-primary-container">
          {iniciales(identity.nombre)}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider">Perfil</span>
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
          <div className="absolute bottom-[4.5rem] right-2 z-50 min-w-60 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg">
            <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                {iniciales(identity.nombre)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{identity.nombre}</p>
                <p className="truncate text-xs text-on-surface-variant">{identity.cedula}</p>
              </div>
            </div>
            <Link
              href={ROUTES.faq}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-on-surface hover:bg-surface-container-high"
            >
              <Icon name="help" />
              Ayuda / Cómo funciona
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
