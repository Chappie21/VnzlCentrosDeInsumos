"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Icon, Qr } from "../../../../_components";
import { INVITAR } from "../../../../constants";
import { crearInvitacion } from "../../../../lib/api";

// Vista "Invitar Ayudantes": genera un token (JWT 1h) y muestra QR + enlace para
// que personas autenticadas se unan como VOLUNTARIO. Solo accesible al JEFE
// (el server lo refuerza con JefeGuard).
export default function InvitarPage() {
  const { centroId } = useParams<{ centroId: string }>();
  const [origin, setOrigin] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const mutation = useMutation({ mutationFn: () => crearInvitacion(centroId) });
  const { mutate } = mutation;

  // Genera el primer token al montar; "Regenerar" vuelve a dispararla.
  useEffect(() => {
    mutate();
  }, [mutate]);

  const token = mutation.data?.token;
  const url = token ? `${origin}/unirse/${token}` : "";

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function descargarQr() {
    const svg = document.querySelector("#invitar-qr svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "invitacion.svg";
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-on-surface">{INVITAR.titulo}</h1>
        <p className="text-on-surface-variant">{INVITAR.subtitulo}</p>
      </div>

      {mutation.isPending && !token && (
        <p className="py-8 text-on-surface-variant">{INVITAR.generando}</p>
      )}

      {mutation.isError && (
        <div className="space-y-3 py-4">
          <p className="text-emergency">{INVITAR.error}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="rounded-lg border border-outline-variant px-4 py-2 text-on-surface-variant hover:bg-surface-container"
          >
            {INVITAR.regenerar}
          </button>
        </div>
      )}

      {token && (
        <>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {INVITAR.escanear}
            </p>
            <div
              id="invitar-qr"
              className="mx-auto w-fit rounded-xl border border-outline-variant bg-white p-6 shadow-sm"
            >
              <Qr value={url} />
            </div>
          </div>

          <div className="space-y-2 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {INVITAR.enlace}
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                aria-label={INVITAR.enlace}
                value={url}
                className="min-w-0 flex-1 rounded-lg border-2 border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              />
              <button
                type="button"
                onClick={copiar}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-safety px-3 py-2 text-sm font-semibold text-white hover:bg-[#3d6649]"
              >
                <Icon name={copiado ? "check" : "content_copy"} className="text-[18px]" />
                {copiado ? INVITAR.copiado : INVITAR.copiar}
              </button>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant">{INVITAR.expira}</p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={descargarQr}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white hover:bg-[#9a2a28] active:scale-[0.98]"
            >
              <Icon name="download" />
              {INVITAR.descargar}
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutate()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
            >
              <Icon name="refresh" />
              {INVITAR.regenerar}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
