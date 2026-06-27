"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "../../../_components";
import { getGuia, type Guia } from "../../../lib/api";
import GuiaView from "./_components/GuiaView";

// Página pública (sin login): la abre el QR de la guía. CEN-18.
export default function GuiaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [guia, setGuia] = useState<Guia | null>(null);
  const [estado, setEstado] = useState<"loading" | "error" | "ok">("loading");
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    setPuedeCompartir(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setGuia(await getGuia(id));
        setEstado("ok");
      } catch {
        setEstado("error");
      }
    })();
  }, [id]);

  async function compartir() {
    try {
      await navigator.share({ title: "Guía de envío", url: window.location.href });
    } catch {
      /* el usuario canceló o no se pudo compartir */
    }
  }

  if (estado === "loading") {
    return <p className="py-12 text-center text-on-surface-variant">Cargando guía…</p>;
  }

  if (estado === "error" || !guia) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <Icon name="error_outline" className="text-4xl text-on-surface-variant" />
        <p className="mt-2 text-on-surface-variant">No se encontró la guía de envío.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <GuiaView guia={guia} />

      {/* Acciones: ocultas al imprimir/PDF */}
      <div className="space-y-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white hover:bg-[#b70011] active:scale-[0.98]"
        >
          <Icon name="picture_as_pdf" />
          Exportar a PDF
        </button>
        {puedeCompartir && (
          <button
            type="button"
            onClick={compartir}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          >
            <Icon name="share" />
            Compartir
          </button>
        )}
      </div>
    </div>
  );
}
