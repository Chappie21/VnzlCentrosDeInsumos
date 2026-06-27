"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Field, Icon, Qr } from "../../../_components";
import { CATEGORIAS, type Categoria } from "../../../constants/categorias";
import {
  encodeDonation,
  totalUnidades,
  type DonationItem,
} from "../../../lib/donation";

// El form maneja categoria como "" (placeholder del select); se mapea a null al donar.
type FormItem = { nombre: string; categoria: Categoria | ""; cantidad: number };
type FormValues = { items: FormItem[] };

const blank = (): FormItem => ({ nombre: "", categoria: "", cantidad: 1 });

function validItems(items: FormItem[]): FormItem[] {
  return items
    .map((i) => ({ ...i, nombre: i.nombre.trim() }))
    .filter((i) => i.nombre && i.cantidad >= 1);
}

function toDonation(items: FormItem[]): DonationItem[] {
  return items.map((i) => ({
    nombre: i.nombre.trim(),
    categoria: i.categoria || null,
    cantidad: i.cantidad,
  }));
}

export default function DonacionForm() {
  // react-hook-form gestiona el carrito (consistencia con el onboarding). El
  // "submit" no va al server: genera el QR en cliente, así que se dispara por
  // botón (no handleSubmit) y se habilita según los ítems válidos.
  const { control, register, watch } = useForm<FormValues>({
    defaultValues: { items: [blank()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const [qr, setQr] = useState<string | null>(null);

  const items = watch("items");
  const valid = validItems(items);
  const total = totalUnidades(toDonation(valid));

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
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="relative space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            {fields.length > 1 && (
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
              {...register(`items.${idx}.nombre`)}
            />

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Categoría
              </label>
              <select
                aria-label="Categoría"
                {...register(`items.${idx}.categoria`)}
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
              <Controller
                control={control}
                name={`items.${idx}.cantidad`}
                render={({ field: f }) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Restar"
                      onClick={() => f.onChange(Math.max(1, f.value - 1))}
                      className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                    >
                      <Icon name="remove" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      aria-label="Cantidad"
                      value={f.value}
                      onBlur={f.onBlur}
                      ref={f.ref}
                      onChange={(e) =>
                        f.onChange(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                      }
                      className="h-12 w-full rounded-lg border-2 border-outline-variant bg-surface text-center text-base text-on-surface focus:border-safety focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Sumar"
                      onClick={() => f.onChange(f.value + 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                    >
                      <Icon name="add" />
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => append(blank())}
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
        onClick={() => setQr(encodeDonation(toDonation(valid)))}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="qr_code_2" />
        Generar QR y Donar
      </button>
    </div>
  );
}
