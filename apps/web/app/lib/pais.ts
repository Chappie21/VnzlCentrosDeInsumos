"use client";

import type { Pais } from "@vnzl/paises";
import { getIdentity } from "./identity";

// ponytail: mapa mínimo zona horaria → país. Venezuela y Colombia son una sola
// zona cada una, así que dos entradas alcanzan. Cualquier otra cosa (VPN, reloj
// mal configurado, render en el servidor) cae a VE, que es el grueso del padrón.
const TZ_PAIS: Record<string, Pais> = {
  "America/Caracas": "VE",
  "America/Bogota": "CO",
};

export const PAIS_POR_DEFECTO: Pais = "VE";

// OJO: en SSR esto devuelve la zona del SERVIDOR (UTC en Vercel), no la del
// visitante. Llamarlo durante el render de un client component produce un
// hydration mismatch — va siempre dentro de un useEffect.
export function paisPorTimezone(): Pais {
  try {
    return TZ_PAIS[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? PAIS_POR_DEFECTO;
  } catch {
    return PAIS_POR_DEFECTO;
  }
}

// País efectivo: el de la cuenta gana; si no hay sesión, el detectado.
export function paisActual(): Pais {
  return getIdentity()?.pais ?? paisPorTimezone();
}

// ¿El formulario tiene que pedir el nombre? En Venezuela lo da el registro civil
// al validar la cédula, así que solo se pide si el portón está apagado. En
// Colombia no hay registro público que consultar y siempre se teclea.
//
// `portonCedulaVe` viene del flag `cedula-validacion-ve` (Railway es la fuente de
// verdad, ver flags.ts). Se pasa como parámetro en vez de leerse acá porque los
// flags se evalúan en el servidor y esta función corre en el cliente.
export function pideNombre(pais: Pais, portonCedulaVe: boolean): boolean {
  return pais !== "VE" || !portonCedulaVe;
}
