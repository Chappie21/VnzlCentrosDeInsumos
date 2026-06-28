"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../../_components";
import { QK, NIVEL_LABEL, NIVEL_BADGE, NIVELES } from "../../../../constants";
import {
  ajustarStock,
  updateInsumo,
  type InsumoDetalle,
  type NivelInsumo,
  type RolCentro,
} from "../../../../lib/api";

// Panel de ajuste de stock (solo JEFE): delta +/- + motivo opcional → POST /historial/ajuste.
function AjustePanel({ centroId, insumo }: { centroId: string; insumo: InsumoDetalle }) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await ajustarStock(centroId, insumo.id, delta, motivo.trim() || undefined);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        throw new Error(msg || "No se pudo ajustar el stock");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QK.centros] });
      setDelta(0);
      setMotivo("");
      setError(null);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Error al ajustar"),
  });

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Ajuste (+/-)
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Restar"
            onClick={() => setDelta((d) => d - 1)}
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
          >
            <Icon name="remove" />
          </button>
          <input
            type="number"
            aria-label="Ajuste"
            value={delta}
            onChange={(e) => setDelta(Math.floor(Number(e.target.value) || 0))}
            className="h-12 w-full rounded-lg border-2 border-outline-variant bg-surface text-center text-base text-on-surface focus:border-safety focus:outline-none"
          />
          <button
            type="button"
            aria-label="Sumar"
            onClick={() => setDelta((d) => d + 1)}
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
          >
            <Icon name="add" />
          </button>
        </div>
      </div>

      <input
        aria-label="Motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        placeholder="Motivo (opcional)"
        className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
      />

      {error && <p className="text-sm text-emergency">{error}</p>}

      <button
        type="button"
        disabled={delta === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "Aplicando…" : "Aplicar ajuste"}
      </button>
    </div>
  );
}

// Una fila: cantidad (read-only, regla de oro) + nivel (cualquier voluntario). Solo el
// JEFE puede ajustar la cantidad vía Historial (tipo AJUSTE). cantidadTotal nunca se
// escribe directo.
function Fila({
  insumo,
  rol,
  centroId,
}: {
  insumo: InsumoDetalle;
  rol: RolCentro;
  centroId: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (nivel: NivelInsumo) => updateInsumo(insumo.id, { nivel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QK.centros] }),
  });

  const [abierto, setAbierto] = useState(false);

  return (
    <li className="border-b border-outline-variant py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-on-surface">{insumo.nombre}</p>
          <p className="text-sm text-on-surface-variant">{insumo.cantidadTotal} en stock</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={`Nivel de ${insumo.nombre}`}
            value={insumo.nivel}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate(e.target.value as NivelInsumo)}
            className={`rounded-badge px-2 py-1 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 ${NIVEL_BADGE[insumo.nivel]}`}
          >
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {NIVEL_LABEL[n]}
              </option>
            ))}
          </select>
          {rol === "JEFE" && (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Ajustar
            </button>
          )}
        </div>
      </div>

      {rol === "JEFE" && abierto && <AjustePanel centroId={centroId} insumo={insumo} />}
    </li>
  );
}

export default function InventarioResumen({
  insumos,
  rol,
  centroId,
}: {
  insumos: InsumoDetalle[];
  rol: RolCentro;
  centroId: string;
}) {
  if (insumos.length === 0) {
    return <p className="text-sm text-on-surface-variant">Sin insumos cargados todavía.</p>;
  }
  return (
    <ul className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4">
      {insumos.map((i) => (
        <Fila key={i.id} insumo={i} rol={rol} centroId={centroId} />
      ))}
    </ul>
  );
}
