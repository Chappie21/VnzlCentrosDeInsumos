"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QK, NIVEL_LABEL, NIVEL_BADGE, NIVELES } from "../../../../constants";
import { updateInsumo, type InsumoDetalle, type NivelInsumo } from "../../../../lib/api";

// Una fila editable: muestra cantidad (read-only, regla de oro) y deja cambiar el
// nivel (cualquier voluntario). cantidadTotal solo se mueve vía donaciones/Historial.
function Fila({ insumo }: { insumo: InsumoDetalle }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (nivel: NivelInsumo) => updateInsumo(insumo.id, { nivel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QK.centros] }),
  });

  return (
    <li className="flex items-center justify-between gap-3 border-b border-outline-variant py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-on-surface">{insumo.nombre}</p>
        <p className="text-sm text-on-surface-variant">{insumo.cantidadTotal} en stock</p>
      </div>
      <select
        aria-label={`Nivel de ${insumo.nombre}`}
        value={insumo.nivel}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as NivelInsumo)}
        className={`shrink-0 rounded-badge px-2 py-1 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 ${NIVEL_BADGE[insumo.nivel]}`}
      >
        {NIVELES.map((n) => (
          <option key={n} value={n}>
            {NIVEL_LABEL[n]}
          </option>
        ))}
      </select>
    </li>
  );
}

export default function InventarioResumen({ insumos }: { insumos: InsumoDetalle[] }) {
  if (insumos.length === 0) {
    return <p className="text-sm text-on-surface-variant">Sin insumos cargados todavía.</p>;
  }
  return (
    <ul className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4">
      {insumos.map((i) => (
        <Fila key={i.id} insumo={i} />
      ))}
    </ul>
  );
}
