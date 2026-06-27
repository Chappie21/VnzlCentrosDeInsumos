"use client";

import { getMe, getToken, setToken } from "./api";

export type Identity = { nombre: string; cedula: string; telefono: string };

const KEY = "identity";

export function getIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

export function setIdentity(identity: Identity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(identity));
  localStorage.removeItem("anon");
}

export function setAnon() {
  if (typeof window === "undefined") return;
  localStorage.setItem("anon", "1");
}

export function hasFullIdentity(): boolean {
  const id = getIdentity();
  return Boolean(id && id.nombre && id.cedula && id.telefono);
}

// User explicitly chose "solo observar" — skip the login gate on landing.
export function isAnon(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("anon") === "1";
}

// Rehydrate localStorage from the backend if this device already onboarded
// but local storage was cleared. Safe to call on mount; no-op on errors.
export async function syncIdentity(): Promise<Identity | null> {
  if (typeof window === "undefined") return null;
  // Cached identity AND token -> no network. If the token is missing (e.g. a
  // pre-JWT device), fall through to /me to mint one.
  if (hasFullIdentity() && getToken()) return getIdentity();
  try {
    const res = await getMe();
    if (!res.ok) return null;
    const me = await res.json();
    if (me?.identidadCompleta && me.nombre && me.cedula && me.telefono) {
      const identity: Identity = {
        nombre: me.nombre,
        cedula: me.cedula,
        telefono: me.telefono,
      };
      setIdentity(identity);
      if (me.token) setToken(me.token); // refresca el JWT en cada apertura
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
  router.push(`/?next=${encodeURIComponent(currentPath)}`);
}
