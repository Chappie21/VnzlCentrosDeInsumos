// Parseo de Excel 100% en el navegador para pre-llenar las filas editables del
// inventario inicial. NO importa al servidor: el usuario revisa/corrige y envía
// por el flujo existente. Único lugar que toca `read-excel-file` (import lazy
// para mantenerlo fuera del bundle principal).
import { CATEGORIA_VALUES, type Categoria } from "../constants/categorias";
import type { InsumoRowItem } from "../_components/InsumoRows";

export type Sheet = { nombre: string; filas: string[][] };
export type ColumnMapping = { nombre: number | null; cantidad: number | null; categoria: number | null };

// ponytail: tope duro de 500 filas para no congelar la UI con planillas enormes.
// Upgrade path: si se necesita más, parsear/renderizar en chunks o web worker.
export const MAX_FILAS = 500;

// Quita acentos y baja a minúsculas para comparar encabezados/valores.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Tipos mínimos del API de read-excel-file que usamos. Los .d.ts del paquete (v9)
// no declaran las opciones getSheets/sheet, así que tipamos localmente lo justo.
type RawCell = string | number | boolean | Date | null;
type ReadXlsx = {
  (file: File, options: { getSheets: true }): Promise<{ name: string }[]>;
  (file: File, options: { sheet: number }): Promise<RawCell[][]>;
};

// Lee el workbook y devuelve cada hoja como matriz de strings. Thin wrapper sin
// tests (necesita la lib + un File real); ver detectColumns/rowsToItems para lo testeado.
export async function readWorkbook(file: File): Promise<Sheet[]> {
  // Subpath /browser: el paquete no expone un export raíz; el build de browser
  // parsea en el hilo principal sin tocar APIs de Node.
  const readXlsxFile = (await import("read-excel-file/browser"))
    .default as unknown as ReadXlsx;
  const sheets = await readXlsxFile(file, { getSheets: true });
  const out: Sheet[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const rows = await readXlsxFile(file, { sheet: i + 1 });
    const filas = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
    out.push({ nombre: sheets[i].name, filas });
  }
  return out;
}

// Sinónimos por columna; se busca por substring sobre el encabezado normalizado.
const SINONIMOS = {
  nombre: ["nombre", "producto", "insumo", "item", "articulo", "descripcion"],
  cantidad: ["cantidad", "stock", "existencia", "unidades", "qty", "cant"],
  categoria: ["categoria", "tipo", "rubro"],
} as const;

// Detecta a qué columna corresponde cada campo según el encabezado.
export function detectColumns(header: string[]): ColumnMapping {
  const norm = header.map(normalize);
  const find = (syns: readonly string[]): number | null => {
    const idx = norm.findIndex((h) => h && syns.some((s) => h.includes(s)));
    return idx === -1 ? null : idx;
  };
  return {
    nombre: find(SINONIMOS.nombre),
    cantidad: find(SINONIMOS.cantidad),
    categoria: find(SINONIMOS.categoria),
  };
}

// Mapea un valor crudo a una de las categorías del enum (match por substring en
// ambos sentidos); si no coincide devuelve "".
export function matchCategoria(raw: string): Categoria | "" {
  const n = normalize(raw);
  if (!n) return "";
  const hit = CATEGORIA_VALUES.find((c) => {
    const cn = normalize(c);
    return n.includes(cn) || cn.includes(n);
  });
  return hit ?? "";
}

// Convierte las filas de datos (desde headerIdx+1) en items para el field array.
// Salta filas sin nombre; coacciona cantidad a entero >=0; cap a MAX_FILAS.
export function rowsToItems(
  filas: string[][],
  mapping: ColumnMapping,
  headerIdx: number,
): { items: InsumoRowItem[]; truncado: boolean } {
  const items: InsumoRowItem[] = [];
  let truncado = false;
  for (let r = headerIdx + 1; r < filas.length; r++) {
    if (mapping.nombre == null) break;
    const fila = filas[r];
    const nombre = (fila[mapping.nombre] ?? "").trim();
    if (!nombre) continue;
    if (items.length >= MAX_FILAS) {
      truncado = true;
      break;
    }
    const cantidad =
      mapping.cantidad != null
        ? Math.max(0, Math.floor(Number(fila[mapping.cantidad]) || 0))
        : 0;
    const categoria =
      mapping.categoria != null ? matchCategoria(fila[mapping.categoria] ?? "") : "";
    items.push({ nombre, categoria, cantidad });
  }
  return { items, truncado };
}
