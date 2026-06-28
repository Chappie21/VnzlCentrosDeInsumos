"use client";

import { Icon } from "../../../../../_components";
import { VOLUNTARIOS } from "../../../../../constants";

// Diálogo de confirmación de remoción (presentacional). Overlay + backdrop como
// el menú de TopAppBar; la lógica de mutación vive en VoluntarioCard.
export default function RemoveConfirm({
  nombre,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  nombre: string;
  pending: boolean;
  error: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={VOLUNTARIOS.cerrar}
        onClick={onCancel}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl text-emergency">
            <Icon name="person_remove" />
          </span>
          <h2 className="text-lg font-bold text-on-surface">
            {VOLUNTARIOS.confirmarTitulo(nombre)}
          </h2>
          <p className="text-sm text-on-surface-variant">{VOLUNTARIOS.confirmarTexto}</p>
        </div>

        {error && <p className="text-center text-sm text-emergency">{VOLUNTARIOS.errorRemover}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-11 flex-1 rounded-lg border border-outline-variant bg-surface-container font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
          >
            {VOLUNTARIOS.cancelar}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-11 flex-1 rounded-lg bg-emergency font-semibold text-white hover:bg-[#9a2a28] disabled:opacity-50"
          >
            {pending ? VOLUNTARIOS.removiendo : VOLUNTARIOS.confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
