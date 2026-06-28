"use client";

import { Icon } from "../../../_components";
import { CATEGORIAS } from "../../../constants/categorias";
import { recepcionResumen, type ScannedItem } from "../../../lib/recepcion";

const catLabel = (value: string | null) =>
  CATEGORIAS.find((c) => c.value === value)?.label ?? null;

export default function RecepcionList({
  items,
  onChange,
  onConfirm,
  submitting = false,
}: {
  items: ScannedItem[];
  onChange: (items: ScannedItem[]) => void;
  onConfirm: () => void;
  submitting?: boolean;
}) {
  const { unidades, categorias } = recepcionResumen(items);
  const hayValidados = items.some((i) => i.validado);

  const patch = (idx: number, p: Partial<ScannedItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((it, idx) => (
          <li
            key={idx}
            className={`relative space-y-3 rounded-xl border bg-surface-container-lowest p-4 ${
              it.validado ? "border-emergency" : "border-outline-variant"
            }`}
          >
            <button
              type="button"
              aria-label="Quitar item"
              onClick={() => remove(idx)}
              className="absolute right-3 top-3 text-on-surface-variant hover:text-emergency"
            >
              <Icon name="close" />
            </button>

            <div className="pr-8">
              <p className="font-semibold text-on-surface">{it.nombre}</p>
              {catLabel(it.categoria) && (
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {catLabel(it.categoria)}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Restar"
                  onClick={() => patch(idx, { cantidad: Math.max(1, it.cantidad - 1) })}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high"
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
                  className="h-10 w-16 rounded-lg border-2 border-outline-variant bg-surface text-center text-on-surface focus:border-safety focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Sumar"
                  onClick={() => patch(idx, { cantidad: it.cantidad + 1 })}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high"
                >
                  <Icon name="add" />
                </button>
              </div>

              <button
                type="button"
                aria-pressed={it.validado}
                onClick={() => patch(idx, { validado: !it.validado })}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  it.validado
                    ? "bg-emergency text-white"
                    : "border border-outline-variant bg-surface-container text-on-surface-variant"
                }`}
              >
                <Icon name={it.validado ? "check_circle" : "radio_button_unchecked"} className="text-[16px]" />
                {it.validado ? "Validado" : "Validar"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        data-testid="resumen-recepcion"
        className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container px-4 py-3"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Resumen de recepción
        </span>
        <span className="text-sm text-on-surface">
          <strong>{unidades}</strong> unidades · <strong>{categorias}</strong> categorías
        </span>
      </div>

      <button
        type="button"
        disabled={!hayValidados || submitting}
        onClick={onConfirm}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#9a2a28] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="check" />
        {submitting ? "Ingresando…" : "Confirmar e Ingresar"}
      </button>
    </div>
  );
}
