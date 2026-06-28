"use client";

import { useMemo, useState } from "react";
import { Icon, type InsumoRowItem } from "../../../../_components";
import { CATEGORIAS } from "../../../../constants/categorias";
import {
  detectColumns,
  rowsToItems,
  type ColumnMapping,
  type Sheet,
} from "../../../../lib/excel";

type Props = {
  sheets: Sheet[];
  onImport: (items: InsumoRowItem[]) => void;
  onCancel: () => void;
};

// Etiqueta legible de una categoría (para la previsualización).
const labelCategoria = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? "";

// Recibe las hojas YA parseadas (testeable sin la librería). UI de mapeo de
// columnas: selector de hoja + selector de fila-encabezado + 3 dropdowns + preview.
export default function ImportarExcel({ sheets, onImport, onCancel }: Props) {
  const [sel, setSel] = useState(0);
  const [headerIdx, setHeaderIdx] = useState(0);

  const filas = sheets[sel]?.filas ?? [];
  const header = filas[headerIdx] ?? [];

  // Re-detecta el mapeo cuando cambia la hoja o la fila de encabezado.
  const detected = useMemo(() => detectColumns(header), [header]);
  // Override manual del usuario; null = "usar lo detectado" (key por sel/headerIdx).
  const [override, setOverride] = useState<ColumnMapping | null>(null);
  const detectKey = `${sel}:${headerIdx}`;
  const [lastKey, setLastKey] = useState(detectKey);
  if (lastKey !== detectKey) {
    setLastKey(detectKey);
    setOverride(null);
  }
  const mapping: ColumnMapping = override ?? detected;

  const changeSheet = (i: number) => {
    setSel(i);
    setHeaderIdx(0);
  };

  const setCol = (campo: keyof ColumnMapping, value: number | null) =>
    setOverride({ ...mapping, [campo]: value });

  const { items, truncado } = useMemo(
    () => rowsToItems(filas, mapping, headerIdx),
    [filas, mapping, headerIdx],
  );

  const puedeImportar = mapping.nombre != null && mapping.cantidad != null;
  const preview = items.slice(0, 5);

  // Primeras ~10 filas como candidatas a encabezado (con un resumen para ubicarlas).
  const headerCandidates = filas.slice(0, 10);

  const colSelect = (
    campo: keyof ColumnMapping,
    label: string,
  ) => (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <select
        aria-label={label}
        value={mapping[campo] ?? ""}
        onChange={(e) => setCol(campo, e.target.value === "" ? null : Number(e.target.value))}
        className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
      >
        <option value="">—</option>
        {header.map((cell, i) => (
          <option key={i} value={i}>
            {cell || `Columna ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Importar desde Excel</h2>
        <button
          type="button"
          aria-label="Cerrar importación"
          onClick={onCancel}
          className="text-on-surface-variant hover:text-emergency"
        >
          <Icon name="close" />
        </button>
      </div>

      {sheets.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Hoja
          </label>
          <select
            aria-label="Hoja"
            value={sel}
            onChange={(e) => changeSheet(Number(e.target.value))}
            className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
          >
            {sheets.map((s, i) => (
              <option key={i} value={i}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Fila de encabezado
        </label>
        <select
          aria-label="Fila de encabezado"
          value={headerIdx}
          onChange={(e) => setHeaderIdx(Number(e.target.value))}
          className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
        >
          {headerCandidates.map((fila, i) => (
            <option key={i} value={i}>
              Fila {i + 1}: {fila.filter(Boolean).slice(0, 4).join(" · ") || "(vacía)"}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {colSelect("nombre", "Nombre *")}
        {colSelect("cantidad", "Cantidad *")}
        {colSelect("categoria", "Categoría")}
      </div>

      {preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Cantidad</th>
                <th className="px-3 py-2">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((it, i) => (
                <tr key={i} className="border-t border-outline-variant">
                  <td className="px-3 py-2">{it.nombre}</td>
                  <td className="px-3 py-2">{it.cantidad}</td>
                  <td className="px-3 py-2">{labelCategoria(it.categoria)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {truncado && (
        <p className="text-sm text-on-surface-variant">
          Se importarán solo las primeras {items.length} filas.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={!puedeImportar || items.length === 0}
          onClick={() => onImport(items)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" />
          Importar {items.length} insumos
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-full items-center justify-center text-sm text-on-surface-variant hover:underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
