import type { DonationItem } from "./donation";
import { ROUTES } from "../constants/routes";

// Item escaneado pendiente de validar por el voluntario antes de ingresarlo.
export type ScannedItem = DonationItem & { validado: boolean };

// Items decodificados de un QR → pendientes de validar.
export function fromDonation(items: DonationItem[]): ScannedItem[] {
  return items.map((i) => ({ ...i, validado: false }));
}

// Payload para POST /historial/recibir: solo lo validado, sin el flag de UI.
export function buildRecibirItems(items: ScannedItem[]): DonationItem[] {
  return items
    .filter((i) => i.validado)
    .map(({ validado: _validado, ...d }) => d);
}

// Decide a dónde va el escáner según el centro en la URL y los centros del voluntario.
// El centro SIEMPRE sale del contexto, nunca de un dropdown al escanear.
export function resolveScanTarget(
  centros: { id: string }[],
  centroParam: string | null,
):
  | { kind: "scan"; centroId: string }
  | { kind: "redirect"; to: string }
  | { kind: "none" } {
  if (centroParam) {
    return centros.some((c) => c.id === centroParam)
      ? { kind: "scan", centroId: centroParam }
      : { kind: "none" }; // no sos voluntario de ese centro
  }
  if (centros.length === 0) return { kind: "none" };
  if (centros.length === 1) return { kind: "redirect", to: `/scanning?centro=${centros[0].id}` };
  return { kind: "redirect", to: ROUTES.misCentros }; // varios → elegir en contexto
}

// Resumen de lo que se va a ingresar (solo validados): unidades y categorías distintas.
export function recepcionResumen(items: ScannedItem[]): {
  unidades: number;
  categorias: number;
} {
  const validos = items.filter((i) => i.validado);
  const unidades = validos.reduce((sum, i) => sum + i.cantidad, 0);
  const categorias = new Set(
    validos.map((i) => i.categoria).filter((c): c is NonNullable<typeof c> => c != null),
  ).size;
  return { unidades, categorias };
}
