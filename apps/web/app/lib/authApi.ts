"use client";

import { apiFetch } from "./api";
import { setToken } from "./auth";

export type AuthUsuario = {
  id: string;
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  identidadCompleta: boolean;
};

async function post(path: string, body: unknown) {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(msg || "No se pudo completar la solicitud");
  }
  return data;
}

export async function login(cedula: string, password: string): Promise<{ token: string; usuario: AuthUsuario }> {
  const r = await post("/auth/login", { cedula, password });
  setToken(r.token);
  return r;
}

export async function register(d: {
  nombre: string;
  cedula: string;
  telefono: string;
  password: string;
}): Promise<{ token: string; usuario: AuthUsuario }> {
  const r = await post("/auth/register", d);
  setToken(r.token);
  return r;
}

export async function googleLogin(
  idToken: string,
): Promise<{ token: string; usuario: AuthUsuario; needsProfile: boolean }> {
  const r = await post("/auth/google", { idToken });
  setToken(r.token);
  return r;
}
