import { getFingerprint } from "../fingerprint";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-fingerprint": getFingerprint(),
      "content-type": "application/json",
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

export type CreateCentroBody = {
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
};

export type CreatedCentro = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  recibiendoAhora: boolean;
};

export function createCentro(body: CreateCentroBody) {
  return apiFetch("/centros", { method: "POST", body: JSON.stringify(body) });
}
