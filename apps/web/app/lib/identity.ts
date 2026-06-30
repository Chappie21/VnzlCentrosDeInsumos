"use client";

import { getMe } from "./api";
import { getToken, clearToken } from "./auth";
import { STORAGE } from "../constants";

export type Identity = { nombre: string; cedula: string; telefono: string };

export function getIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE.identity);
    if (!raw) return null;
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

export function setIdentity(identity: Identity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE.identity, JSON.stringify(identity));
  localStorage.removeItem(STORAGE.anon);
}

export function setAnon() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE.anon, "1");
}

export function hasFullIdentity(): boolean {
  const id = getIdentity();
  return Boolean(id && id.nombre && id.cedula && id.telefono);
}

// User explicitly chose "solo observar" — skip the login gate on landing.
export function isAnon(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE.anon) === "1";
}

// Rehydrate localStorage from the backend if this device already onboarded
// but local storage was cleared. Safe to call on mount; no-op on errors.
export async function syncIdentity(): Promise<Identity | null> {
  if (typeof window === "undefined") return null;
  if (hasFullIdentity()) return getIdentity();
  if (!getToken()) return null; // sin sesión no hay nada que rehidratar
  try {
    const res = await getMe();
    if (res.status === 401) {
      clearToken(); // sesión vencida/inválida
      return null;
    }
    if (!res.ok) return null;
    const me = await res.json();
    if (me?.identidadCompleta && me.nombre && me.cedula && me.telefono) {
      const identity: Identity = {
        nombre: me.nombre,
        cedula: me.cedula,
        telefono: me.telefono,
      };
      setIdentity(identity);
      return identity;
    }
  } catch {
    /* ignore */
  }
  return null;
}

type Pushable = { push: (url: string) => void };

// Gate an action behind a complete identity. If present, run it; otherwise
// route to onboarding with a `next` back to the current path.
export function requireHelp(router: Pushable, currentPath: string, action?: () => void) {
  if (hasFullIdentity()) {
    action?.();
    return;
  }
  router.push(`/login?next=${encodeURIComponent(currentPath)}`);
}
