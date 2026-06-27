import { NivelInsumo } from "@vnzl/database";

// Orden de prioridad para elegir qué necesidades mostrar primero en la card.
// URGENTE arriba (lo más alarmante), SUFICIENTE al final.
export const NIVEL_ORDER: Record<NivelInsumo, number> = {
  [NivelInsumo.URGENTE]: 0,
  [NivelInsumo.NORMAL]: 1,
  [NivelInsumo.SUFICIENTE]: 2,
};
