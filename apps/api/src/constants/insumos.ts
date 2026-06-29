import { NivelInsumo } from "@vnzl/database";

// Orden de prioridad para elegir qué necesidades mostrar primero en la card.
// URGENTE arriba (lo más alarmante), SUFICIENTE al final.
export const NIVEL_ORDER: Record<NivelInsumo, number> = {
  [NivelInsumo.URGENTE]: 0,
  [NivelInsumo.NORMAL]: 1,
  [NivelInsumo.SUFICIENTE]: 2,
};

// Único punto de la lógica de bandas. `null` = sin umbrales = no tocar el nivel (manual).
// 3 bandas con 2 cortes: <= urgente -> URGENTE, >= suficiente -> SUFICIENTE, medio -> NORMAL.
export function calcularNivel(
  cantidad: number,
  umbralUrgente: number | null,
  umbralSuficiente: number | null,
): NivelInsumo | null {
  if (umbralUrgente == null || umbralSuficiente == null) return null;
  if (cantidad <= umbralUrgente) return NivelInsumo.URGENTE;
  if (cantidad >= umbralSuficiente) return NivelInsumo.SUFICIENTE;
  return NivelInsumo.NORMAL;
}
