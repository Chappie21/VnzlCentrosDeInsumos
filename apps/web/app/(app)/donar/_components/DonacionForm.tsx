"use client";

import { useState } from "react";
import { Field, Icon, Qr } from "../../../_components";
import { CATEGORIAS, type Categoria } from "../../../constants/categorias";
import {
  encodeDonation,
  totalUnidades,
  type DonationItem,
} from "../../../lib/donation";

const blank = (): DonationItem => ({ nombre: "", categoria: null, cantidad: 1 });

function validItems(items: DonationItem[]): DonationItem[] {
  return items
    .map((i) => ({ ...i, nombre: i.nombre.trim() }))
    .filter((i) => i.nombre && i.cantidad >= 1);
}

export default function DonacionForm() {
  const [items, setItems] = useState<DonationItem[]>([blank()]);
  const [qr, setQr] = useState<string | null>(null);

  const valid = validItems(items);
  const total = totalUnidades(valid);

  function patch(idx: number, p: Partial<DonationItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  }
  function remove(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  // Pantalla "Listo para entregar" (img 3): el donante muestra este QR al voluntario.
  if (qr) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 py-4 text-center">
        <div>
          <h2 className="text-2xl font-semibold text-on-surface">Listo para entregar</h2>
          <p className="mt-1 text-on-surface-variant">
            Muestra este código al voluntario al llegar al centro.
          </p>
        </div>

        <div className="mx-auto w-fit rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <Qr value={qr} />
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Resumen de la donación · {total} unidades
          </p>
          <ul className="space-y-2">
            {valid.map((it, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="inline-flex min-w-9 justify-center rounded bg-emergency px-2 py-1 text-sm font-bold text-white">
                  {it.cantidad}×
                </span>
                <span className="text-on-surface">{it.nombre}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setQr(null)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-[0.98]"
        >
          <Icon name="edit" />
          Volver a editar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-4">
      <div>
        <h2 className="text-2xl font-semibold text-on-surface">Crear Donación</h2>
        <p className="mt-1 text-on-surface-variant">
          Registra los insumos para generar un código QR de seguimiento.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="relative space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            {items.length > 1 && (
              <button
                type="button"
                aria-label="Quitar insumo"
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

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Categoría
              </label>
              <select
                aria-label="Categoría"
                value={it.categoria ?? ""}
                onChange={(e) =>
                  patch(idx, { categoria: (e.target.value || null) as Categoria | null })
                }
                className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Cantidad
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Restar"
                  onClick={() => patch(idx, { cantidad: Math.max(1, it.cantidad - 1) })}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                >
                  <Icon name="remove" />
                </button>
                <input
                  type="number"
                  min={1}
                  aria-label="Cantidad"
                  value={it.cantidad}
                  onChange={(e) =>
                    patch(idx, { cantidad: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                  }
                  className="h-12 w-full rounded-lg border-2 border-outline-variant bg-surface text-center text-base text-on-surface focus:border-safety focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Sumar"
                  onClick={() => patch(idx, { cantidad: it.cantidad + 1 })}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                >
                  <Icon name="add" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, blank()])}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant py-3 text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="add" />
        Agregar otro insumo
      </button>

      <div className="flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="text-on-surface-variant">Total unidades:</span>
        <span data-testid="total-unidades" className="text-xl font-bold text-on-surface">
          {total}
        </span>
      </div>

      {/* ponytail: sin botón "Guardar" — el QR es stateless, no hay borrador que persistir.
          Si se quiere guardar borradores, agregar localStorage + carga al montar. */}
      <button
        type="button"
        disabled={valid.length === 0}
        onClick={() => setQr(encodeDonation(valid))}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="qr_code_2" />
        Generar QR y Donar
      </button>
    </div>
  );
}
