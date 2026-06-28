import { CATEGORIAS } from "../constants";

// Helpers puros para el reporte de inventario (testeables, sin React).

// Mapa categoria(enum) → label en español. Categorías desconocidas o null caen
// en "Sin categoría".
const LABELS = new Map<string, string>(CATEGORIAS.map((c) => [c.value, c.label]));
const SIN_CATEGORIA = "Sin categoría";

// Suma total de cantidades de los insumos.
export function totalInsumos(insumos: { cantidadTotal: number }[]): number {
  return insumos.reduce((acc, i) => acc + i.cantidadTotal, 0);
}

// Agrupa por categoría, suma cantidades y calcula el % sobre el total.
// Ordena descendente por cantidad. categoria null → grupo "Sin categoría".
export function distribucionPorCategoria(
  insumos: { categoria: string | null; cantidadTotal: number }[],
): { categoria: string; label: string; cantidad: number; pct: number }[] {
  const total = totalInsumos(insumos);

  // Acumula por clave de categoría (preservando "value" del enum o null→SIN).
  const grupos = new Map<string, number>();
  for (const i of insumos) {
    const key = i.categoria ?? SIN_CATEGORIA;
    grupos.set(key, (grupos.get(key) ?? 0) + i.cantidadTotal);
  }

  return [...grupos.entries()]
    .map(([categoria, cantidad]) => ({
      categoria,
      label: LABELS.get(categoria) ?? SIN_CATEGORIA,
      cantidad,
      pct: total > 0 ? (cantidad / total) * 100 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}
