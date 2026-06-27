import type { Categoria } from "../constants/categorias";

export type ImportItem = { nombre: string; categoria: Categoria | null; cantidad: number };
export type ImportResult = { items: ImportItem[]; warnings: string[] };

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .toLowerCase()
    .trim();

// Sinónimos comunes → enum CategoriaInsumo. Lo no reconocido queda null.
const SINONIMOS: Record<string, Categoria> = {
  agua: "AGUA",
  hidratacion: "AGUA",
  water: "AGUA",
  alimentos: "ALIMENTOS",
  alimento: "ALIMENTOS",
  comida: "ALIMENTOS",
  food: "ALIMENTOS",
  medicamentos: "MEDICAMENTOS",
  medicamento: "MEDICAMENTOS",
  medicinas: "MEDICAMENTOS",
  medicina: "MEDICAMENTOS",
  "insumos medicos": "MEDICAMENTOS",
  salud: "MEDICAMENTOS",
  medical: "MEDICAMENTOS",
  ropa: "ROPA",
  abrigo: "ROPA",
  vestimenta: "ROPA",
  mantas: "ROPA",
  clothes: "ROPA",
  herramientas: "HERRAMIENTAS",
  herramienta: "HERRAMIENTAS",
  tools: "HERRAMIENTAS",
};

export function mapCategoria(raw: string | null | undefined): Categoria | null {
  const k = norm(raw);
  if (!k) return null;
  return SINONIMOS[k] ?? null;
}

// Toma el valor de una fila probando varios nombres de columna (case/acentos-insensible).
function field(row: Record<string, unknown>, candidatos: string[]): unknown {
  const keys = Object.keys(row);
  for (const want of candidatos) {
    const k = keys.find((key) => norm(key) === want);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

// Filas (objetos por encabezado, de SheetJS) → items + avisos. Tolera columnas en
// distinto orden/idioma y datos sucios; nunca tira, acumula warnings.
export function parseInventarioRows(rows: Record<string, unknown>[]): ImportResult {
  const items: ImportItem[] = [];
  const warnings: string[] = [];

  rows.forEach((row, i) => {
    const nombre = String(field(row, ["nombre", "insumo", "item", "producto"]) ?? "").trim();
    const catRaw = field(row, ["categoria", "tipo", "rubro"]);
    const cantRaw = field(row, ["cantidad", "cant", "qty", "stock"]);
    const catStr = catRaw == null ? "" : String(catRaw).trim();
    const cantStr = cantRaw == null ? "" : String(cantRaw).trim();

    // Fila completamente vacía: la salteamos en silencio.
    if (!nombre && !catStr && !cantStr) return;

    const fila = i + 1;
    if (!nombre) {
      warnings.push(`Fila ${fila}: sin nombre, omitida.`);
      return;
    }
    const cantidad = Math.floor(Number(cantStr));
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      warnings.push(`Fila ${fila} (${nombre}): cantidad inválida "${cantStr}", omitida.`);
      return;
    }
    const categoria = mapCategoria(catStr);
    if (catStr && categoria === null) {
      warnings.push(`Fila ${fila} (${nombre}): categoría "${catStr}" no reconocida, quedó en blanco.`);
    }
    items.push({ nombre, categoria, cantidad });
  });

  return { items, warnings };
}
