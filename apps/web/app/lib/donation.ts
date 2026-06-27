import { CATEGORIA_VALUES, type Categoria } from "../constants/categorias";

export type DonationItem = {
  nombre: string;
  categoria: Categoria | null;
  cantidad: number;
};

// El QR es stateless: lleva solo la lista de insumos donados (nombre + cantidad +
// categoría opcional). El centro lo escanea y hace upsert por nombre (CEN-12).
// Claves cortas (n/c/q) para densidad del QR; versionado para evolucionar el formato.
const VERSION = 1;
type Wire = { v: number; items: { n: string; c: string | null; q: number }[] };

export function encodeDonation(items: DonationItem[]): string {
  const wire: Wire = {
    v: VERSION,
    items: items.map((i) => ({ n: i.nombre, c: i.categoria, q: i.cantidad })),
  };
  return JSON.stringify(wire);
}

export function decodeDonation(raw: string): DonationItem[] {
  const data = JSON.parse(raw) as Wire; // lanza si no es JSON
  if (data?.v !== VERSION) throw new Error("Versión de donación no soportada");
  if (!Array.isArray(data.items) || data.items.length === 0)
    throw new Error("Donación vacía");

  return data.items.map((it) => {
    const nombre = String(it.n ?? "").trim();
    if (!nombre) throw new Error("Insumo sin nombre");
    if (!Number.isInteger(it.q) || it.q < 1)
      throw new Error(`Cantidad inválida para "${nombre}"`);
    if (it.c !== null && !CATEGORIA_VALUES.includes(it.c as Categoria))
      throw new Error(`Categoría inválida para "${nombre}"`);
    return { nombre, categoria: it.c as Categoria | null, cantidad: it.q };
  });
}

export function totalUnidades(items: DonationItem[]): number {
  return items.reduce((sum, i) => sum + i.cantidad, 0);
}
