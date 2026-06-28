"use client";

import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import Field from "./Field";
import Icon from "./Icon";
import { CATEGORIAS, type Categoria } from "../constants/categorias";

// El form maneja categoria como "" (placeholder del select).
export type InsumoRowItem = { nombre: string; categoria: Categoria | ""; cantidad: number };
export type InsumoRowsValues = { items: InsumoRowItem[] };

type Props = {
  control: Control<InsumoRowsValues>;
  register: UseFormRegister<InsumoRowsValues>;
  fields: { id: string }[];
  remove: (index: number) => void;
  // Piso del stepper: 1 (donación) o 0 (carga inicial, B3).
  min: number;
};

// Filas de item compartidas (donación / inventario inicial): nombre + categoría +
// stepper de cantidad. El piso del stepper es configurable vía `min`.
export default function InsumoRows({ control, register, fields, remove, min }: Props) {
  return (
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
                    onClick={() => f.onChange(Math.max(min, f.value - 1))}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                  >
                    <Icon name="remove" />
                  </button>
                  <input
                    type="number"
                    min={min}
                    aria-label="Cantidad"
                    value={f.value}
                    onBlur={f.onBlur}
                    ref={f.ref}
                    onChange={(e) =>
                      f.onChange(Math.max(min, Math.floor(Number(e.target.value) || min)))
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
  );
}
