"use client";

import { STORAGE } from "../constants";

// JWT de sesión de usuario. Bearer en cada request (ver apiFetch).
export const getToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(STORAGE.token);

export const setToken = (t: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE.token, t);
  localStorage.removeItem(STORAGE.anon); // ya no es anónimo
};

// Logout: borra sesión + cache de perfil.
export const clearToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.identity);
};
