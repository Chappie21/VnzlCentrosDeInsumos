"use client";

import dynamic from "next/dynamic";

const ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// Carga diferida: @react-oauth/google se baja recién cuando se renderiza el botón.
const GoogleAuthProvider = dynamic(() => import("./GoogleAuthProvider"), { ssr: false });

// Botón "Continuar con Google". Si no hay client ID configurado, no se muestra
// (y el chunk de Google ni siquiera se pide).
export function GoogleButton() {
  if (!ENABLED) return null;
  return <GoogleAuthProvider />;
}
