"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { Icon, InsumoRows, type InsumoRowItem, type InsumoRowsValues } from "../../../../_components";
import type { InsumoInicial } from "../../../../lib/api";

const blank = (): InsumoRowItem => ({ nombre: "", categoria: "", cantidad: 1 });

// Mapea las filas válidas (nombre no vacío) al payload de carga inicial.
function toInsumos(items: InsumoRowItem[]): InsumoInicial[] {
  return items
    .filter((i) => i.nombre.trim())
    .map((i) => ({
      nombre: i.nombre.trim(),
      ...(i.categoria ? { categoria: i.categoria } : {}),
      cantidad: i.cantidad,
    }));
}

type Props = {
  onSubmit: (insumos: InsumoInicial[]) => void;
  onBack: () => void;
  pending: boolean;
  apiError: string | null;
};

// Paso 2 de crear centro: inventario inicial opcional. Reusa InsumoRows con min=0
// (B3: permite 0). "Registrar" siembra los insumos; "Omitir" crea sin insumos.
export default function InventarioInicialForm({ onSubmit, onBack, pending, apiError }: Props) {
  const { control, register, watch } = useForm<InsumoRowsValues>({
    defaultValues: { items: [blank()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = watch("items");
  // No se puede registrar si alguna fila quedó con nombre vacío.
  const incompleto = items.some((i) => !i.nombre.trim());

  return (
    <div className="mx-auto flex w-full max-w-md flex-grow flex-col">
      <div className="flex-grow space-y-6 px-4 py-6">
        <p className="text-base text-on-surface-variant">
          Registra el inventario que el centro ya posee (opcional). Podés omitir este
          paso y cargarlo más tarde.
        </p>

        <InsumoRows control={control} register={register} fields={fields} remove={remove} min={0} />

        <button
          type="button"
          onClick={() => append(blank())}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant py-3 text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="add" />
          Agregar insumo
        </button>

        {apiError && <p className="text-sm text-emergency">{apiError}</p>}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-outline-variant bg-surface px-4 py-4">
        <button
          type="button"
          disabled={incompleto || pending}
          onClick={() => onSubmit(toInsumos(items))}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white shadow-sm transition-colors hover:bg-[#b70011] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="check" />
          {pending ? "Registrando…" : "Registrar Centro"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onSubmit([])}
          className="flex h-12 w-full items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
        >
          Omitir por ahora
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="flex h-10 w-full items-center justify-center gap-1 text-sm text-on-surface-variant hover:underline disabled:opacity-50"
        >
          <Icon name="arrow_back" />
          Volver a los datos
        </button>
      </div>
    </div>
  );
}
