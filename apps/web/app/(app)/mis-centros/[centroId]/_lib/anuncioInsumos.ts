import type { InsumoDetalle } from "../../../../lib/api";

export type Necesidades = {
  /** Insumos a mostrar (ya capados por `max`). */
  items: InsumoDetalle[];
  /** Cuántos quedaron fuera del cap (para "+N más"); 0 si ninguno. */
  extra: number;
  /** Qué nivel se terminó mostrando; null si vacío. */
  nivelUsado: "URGENTE" | "NORMAL" | null;
  /** true si no hay ni URGENTE ni NORMAL. */
  vacio: boolean;
};

/**
 * Selecciona las "necesidades" a mostrar en el anuncio. Prioriza URGENTE;
 * si no hay urgentes usa NORMAL; si tampoco hay, queda vacío. Capea a `max`.
 */
export function seleccionarNecesidades(
  insumos: InsumoDetalle[],
  max = 8,
): Necesidades {
  const urgentes = insumos.filter((i) => i.nivel === "URGENTE");
  const set = urgentes.length > 0 ? urgentes : insumos.filter((i) => i.nivel === "NORMAL");

  if (set.length === 0) {
    return { items: [], extra: 0, nivelUsado: null, vacio: true };
  }

  const nivelUsado: "URGENTE" | "NORMAL" =
    urgentes.length > 0 ? "URGENTE" : "NORMAL";

  return {
    items: set.slice(0, max),
    extra: Math.max(0, set.length - max),
    nivelUsado,
    vacio: false,
  };
}
