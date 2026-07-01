"use client";

import { useState } from "react";
import { Icon } from "../../../_components";
import { reportarCentro } from "../../../lib/api";
import ReportarSheet from "./ReportarSheet";

// Acción de reporte en la card del directorio. Anónimo (fingerprint).
export default function ReportarButton({ centroId, nombre }: { centroId: string; nombre: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // La card es un <Link>; sin preventDefault el click navega al detalle.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:text-emergency"
      >
        <Icon name="flag" className="text-[14px]" />
        Reportar
      </button>
      {open && (
        <ReportarSheet
          nombre={nombre}
          onConfirmar={(motivo, comentario) => reportarCentro(centroId, motivo, comentario || undefined)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
