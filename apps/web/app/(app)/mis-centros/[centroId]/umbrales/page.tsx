"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "../../../../_components";
import { centrosKeys } from "../../../../constants";
import { useCentroDetalle } from "../../../../_hooks";
import { updateUmbrales, type UmbralFila } from "../../../../lib/api";

// "" -> null (limpiar umbral); número válido -> Int. Negativos no permitidos (Min 0 en backend).
const parse = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Configurar umbrales por insumo (solo JEFE). Si un insumo tiene AMBOS umbrales, su
// nivel pasa a automático (se recalcula con el stock). Dejar uno vacío = nivel manual.
export default function UmbralesPage() {
  const { centroId } = useParams<{ centroId: string }>();
  const { data, isLoading, isError } = useCentroDetalle(centroId);
  const queryClient = useQueryClient();

  // Estado local de los inputs: insumoId -> { u, s } como strings ("" = sin umbral).
  const [filas, setFilas] = useState<Record<string, { u: string; s: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const valor = (id: string, campo: "u" | "s", fallback: number | null) =>
    filas[id]?.[campo] ?? (fallback == null ? "" : String(fallback));

  const set = (id: string, campo: "u" | "s", v: string, otros: { u: string; s: string }) =>
    setFilas((prev) => ({ ...prev, [id]: { ...otros, ...prev[id], [campo]: v } }));

  const mutation = useMutation({
    mutationFn: async () => {
      const insumos: UmbralFila[] = (data?.insumos ?? []).map((i) => ({
        insumoId: i.id,
        umbralUrgente: parse(valor(i.id, "u", i.umbralUrgente)),
        umbralSuficiente: parse(valor(i.id, "s", i.umbralSuficiente)),
      }));
      // Validación de coherencia antes de mandar (el backend la repite).
      const malo = insumos.find(
        (f) => f.umbralUrgente != null && f.umbralSuficiente != null && f.umbralUrgente >= f.umbralSuficiente,
      );
      if (malo) throw new Error("El umbral 'urgente' debe ser menor que 'suficiente'.");

      const res = await updateUmbrales(centroId, insumos);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        const msg = Array.isArray(d?.message) ? d.message.join(" ") : d?.message;
        throw new Error(msg || "No se pudieron guardar los umbrales");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: centrosKeys.detalle(centroId) });
      setError(null);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Error al guardar"),
  });

  if (data && data.rol !== "JEFE") {
    return (
      <EmptyState
        icon="lock"
        title="Solo el jefe del centro"
        subtitle="Únicamente el jefe puede configurar los umbrales de inventario."
      />
    );
  }

  if (isLoading) {
    return <p className="py-8 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon="error"
        title="No se pudo cargar el centro"
        subtitle="Puede que no seas miembro o que haya un problema de conexión."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">Configurar umbrales</h1>
        <p className="text-on-surface-variant">
          Definí el stock esperado por insumo. Con ambos valores, el nivel (urgente / normal /
          suficiente) se ajusta solo según el stock. Dejá un campo vacío para volver al nivel manual.
        </p>
      </header>

      {data.insumos.length === 0 ? (
        <EmptyState icon="inventory_2" title="Sin insumos" subtitle="Cargá inventario para configurar umbrales." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.insumos.map((i) => {
            const otros = { u: i.umbralUrgente == null ? "" : String(i.umbralUrgente), s: i.umbralSuficiente == null ? "" : String(i.umbralSuficiente) };
            return (
              <li
                key={i.id}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium text-on-surface">{i.nombre}</p>
                  <p className="shrink-0 text-sm text-on-surface-variant">{i.cantidadTotal} en stock</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Urgente si ≤
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={valor(i.id, "u", i.umbralUrgente)}
                      onChange={(e) => set(i.id, "u", e.target.value, otros)}
                      placeholder="—"
                      className="h-12 rounded-lg border-2 border-outline-variant bg-surface px-3 text-base text-on-surface focus:border-safety focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Suficiente si ≥
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={valor(i.id, "s", i.umbralSuficiente)}
                      onChange={(e) => set(i.id, "s", e.target.value, otros)}
                      placeholder="—"
                      className="h-12 rounded-lg border-2 border-outline-variant bg-surface px-3 text-base text-on-surface focus:border-safety focus:outline-none"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-emergency">{error}</p>}

      {data.insumos.length > 0 && (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white shadow-sm transition-colors hover:bg-[#3d6649] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Guardando…" : "Guardar umbrales"}
        </button>
      )}
    </div>
  );
}
