import { getFingerprint } from "../fingerprint";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-fingerprint": getFingerprint(),
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers),
    },
  });
}

export type OnboardBody = { nombre: string; cedula: string; telefono: string };

export type Me = {
  fingerprint: string;
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  identidadCompleta: boolean;
  token: string | null;
};

export function onboard(body: OnboardBody) {
  return apiFetch("/usuarios/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMe() {
  return apiFetch("/usuarios/me");
}
