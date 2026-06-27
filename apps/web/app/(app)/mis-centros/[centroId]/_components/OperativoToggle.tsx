"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../../_components";
import { QK } from "../../../../constants";
import { updateOperativo, type CentroDetalle } from "../../../../lib/api";

// Toggle de recepción (cualquier voluntario). Optimista vía invalidación del detalle.
export default function OperativoToggle({ centro }: { centro: CentroDetalle }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (recibiendoAhora: boolean) =>
      updateOperativo(centro.id, { recibiendoAhora }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QK.centros] }),
  });

  const on = centro.recibiendoAhora;
  return (
    <button
      type="button"
      onClick={() => mutation.mutate(!on)}
      disabled={mutation.isPending}
      aria-pressed={on}
      className="flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 disabled:opacity-50"
    >
      <span className="flex items-center gap-2 font-medium text-on-surface">
        <Icon name={on ? "toggle_on" : "toggle_off"} className={on ? "text-emergency" : "text-outline"} />
        Recibiendo ahora
      </span>
      <span className="text-sm text-on-surface-variant">{on ? "Activo" : "Cerrado"}</span>
    </button>
  );
}
