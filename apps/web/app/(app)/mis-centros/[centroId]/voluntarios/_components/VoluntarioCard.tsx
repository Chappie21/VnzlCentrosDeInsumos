"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../../../_components";
import { ROL_LABEL, VOLUNTARIOS, centrosKeys } from "../../../../../constants";
import { removerVoluntario, type VoluntarioItem } from "../../../../../lib/api";
import RemoveConfirm from "./RemoveConfirm";

// Card de un voluntario con su rol y contacto. El botón remover solo aparece para
// VOLUNTARIO (al jefe no se lo remueve; el server lo refuerza con JefeGuard).
export default function VoluntarioCard({
  centroId,
  voluntario,
}: {
  centroId: string;
  voluntario: VoluntarioItem;
}) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const esJefe = voluntario.rol === "JEFE";
  const nombre = voluntario.nombre ?? "Voluntario";

  const mutation = useMutation({
    mutationFn: () => removerVoluntario(centroId, voluntario.id),
    onSuccess: () => {
      setConfirming(false);
      // refresca la lista y el conteo del detalle.
      queryClient.invalidateQueries({ queryKey: centrosKeys.voluntarios(centroId) });
      queryClient.invalidateQueries({ queryKey: centrosKeys.detalle(centroId) });
    },
  });

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold text-on-surface">{nombre}</p>
        <p className="text-sm text-on-surface-variant">{ROL_LABEL[voluntario.rol]}</p>
        {voluntario.telefono && (
          <p className="mt-1 flex items-center gap-1 text-sm text-on-surface-variant">
            <Icon name="call" className="text-[16px]" />
            {voluntario.telefono}
          </p>
        )}
        {voluntario.cedula && (
          <p className="flex items-center gap-1 text-sm text-on-surface-variant">
            <Icon name="badge" className="text-[16px]" />
            {voluntario.cedula}
          </p>
        )}
      </div>

      {!esJefe && (
        <button
          type="button"
          aria-label={VOLUNTARIOS.removerAria(nombre)}
          onClick={() => setConfirming(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-emergency/10 hover:text-emergency"
        >
          <Icon name="person_remove" />
        </button>
      )}

      {confirming && (
        <RemoveConfirm
          nombre={nombre}
          pending={mutation.isPending}
          error={mutation.isError}
          onConfirm={() => mutation.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
