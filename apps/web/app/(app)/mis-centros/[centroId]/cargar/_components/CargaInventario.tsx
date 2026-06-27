"use client";

import { useRef, useState } from "react";
import { Field, Icon } from "../../../../../_components";
import { CATEGORIAS, type Categoria } from "../../../../../constants/categorias";
import { parseInventarioRows } from "../../../../../lib/inventario-import";
import type { DonationItem } from "../../../../../lib/donation";

type Row = { nombre: string; categoria: Categoria | ""; cantidad: number };
const blank = (): Row => ({ nombre: "", categoria: "", cantidad: 1 });

export default function CargaInventario({
  onConfirmar,
  submitting = false,
}: {
  onConfirmar: (items: DonationItem[]) => void;
  submitting?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = rows.filter((r) => r.nombre.trim() && r.cantidad >= 1);
  const items: DonationItem[] = valid.map((r) => ({
    nombre: r.nombre.trim(),
    categoria: r.categoria || null,
    cantidad: r.cantidad,
  }));

  const patch = (i: number, p: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a subir el mismo archivo
    if (!file) return;
    try {
      const XLSX = await import("xlsx"); // dynamic: no infla el bundle principal
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
      const { items: parsed, warnings: w } = parseInventarioRows(raw);
      if (parsed.length === 0) {
        setWarnings(["No se encontraron filas válidas. Revisá las columnas: nombre, categoria, cantidad.", ...w]);
        return;
      }
      setRows((prev) => [
        ...prev.filter((r) => r.nombre.trim()), // descarta filas en blanco
        ...parsed.map((p) => ({
          nombre: p.nombre,
          categoria: (p.categoria ?? "") as Categoria | "",
          cantidad: p.cantidad,
        })),
      ]);
      setWarnings(w);
    } catch {
      setWarnings(["No se pudo leer el archivo. Usá .xlsx o .csv con columnas nombre, categoria, cantidad."]);
    }
  }

  function descargarPlantilla() {
    const csv =
      "nombre,categoria,cantidad\nAgua embotellada,Hidratación,10\nArroz,Comida,25\nVendas,Insumos médicos,8\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-inventario.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Importar / plantilla */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Archivo de inventario"
          onChange={onFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-safety px-3 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <Icon name="upload_file" />
          Importar Excel/CSV
        </button>
        <button
          type="button"
          onClick={descargarPlantilla}
          className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="download" />
          Plantilla
        </button>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">
          {warnings.map((w, i) => (
            <li key={i}>⚠️ {w}</li>
          ))}
        </ul>
      )}

      {/* Filas editables */}
      <div className="space-y-3">
        {rows.map((it, idx) => (
          <div
            key={idx}
            className="relative space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            {rows.length > 1 && (
              <button
                type="button"
                aria-label="Quitar fila"
                onClick={() => remove(idx)}
                className="absolute right-3 top-3 text-on-surface-variant hover:text-emergency"
              >
                <Icon name="close" />
              </button>
            )}
            <Field
              label="Nombre del Insumo"
              icon="inventory_2"
              placeholder="Ej. Agua embotellada"
              value={it.nombre}
              onChange={(e) => patch(idx, { nombre: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                aria-label="Categoría"
                value={it.categoria}
                onChange={(e) => patch(idx, { categoria: e.target.value as Categoria | "" })}
                className="flex-1 rounded-lg border-2 border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-safety focus:outline-none"
              >
                <option value="">Sin categoría</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                aria-label="Cantidad"
                value={it.cantidad}
                onChange={(e) =>
                  patch(idx, { cantidad: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                }
                className="w-20 rounded-lg border-2 border-outline-variant bg-surface text-center text-on-surface focus:border-safety focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, blank()])}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant py-3 text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="add" />
        Agregar fila
      </button>

      <button
        type="button"
        disabled={items.length === 0 || submitting}
        onClick={() => onConfirmar(items)}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="inventory" />
        {submitting ? "Cargando…" : `Cargar al inventario (${items.length})`}
      </button>
    </div>
  );
}
