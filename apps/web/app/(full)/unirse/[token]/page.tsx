"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../_components";
import { QK, ROUTES, UNIRSE } from "../../../constants";
import { hasFullIdentity, syncIdentity } from "../../../lib/identity";
import { aceptarInvitacion, type InvitacionAceptada } from "../../../lib/api";

// Página pública (sin chrome) a la que apunta el QR/link de invitación. Si el
// usuario no tiene identidad completa, pasa por onboarding y vuelve; si la tiene,
// acepta la invitación y se une como VOLUNTARIO.
export default function UnirsePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState<"loading" | "error" | "ok">("loading");
  const [centro, setCentro] = useState<InvitacionAceptada | null>(null);

  useEffect(() => {
    (async () => {
      const ok = hasFullIdentity() || (await syncIdentity()) != null;
      if (!ok) {
        router.replace(`/login?next=${encodeURIComponent(ROUTES.unirse(token))}`);
        return;
      }
      try {
        const res = await aceptarInvitacion(token);
        setCentro(res);
        queryClient.invalidateQueries({ queryKey: [QK.centros] });
        setEstado("ok");
      } catch {
        setEstado("error");
      }
    })();
  }, [token, router, queryClient]);

  if (estado === "loading") {
    return <p className="py-12 text-center text-on-surface-variant">{UNIRSE.cargando}</p>;
  }

  if (estado === "error" || !centro) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-12 text-center">
        <Icon name="error_outline" className="text-5xl text-on-surface-variant" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-on-surface">{UNIRSE.errorTitulo}</h1>
          <p className="text-on-surface-variant">{UNIRSE.errorSubtitulo}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(ROUTES.centros)}
          className="rounded-lg border border-outline-variant px-4 py-2 text-on-surface-variant hover:bg-surface-container"
        >
          {UNIRSE.irDirectorio}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
        <Icon name="check_circle" filled className="text-5xl" />
      </div>
      <h1 className="text-2xl font-semibold text-on-surface">{UNIRSE.exito(centro.nombre)}</h1>
      <button
        type="button"
        onClick={() => router.push(ROUTES.misCentroDetalle(centro.centroId))}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-safety font-semibold text-white hover:bg-[#3d6649] active:scale-[0.98]"
      >
        <Icon name="store" />
        {UNIRSE.verCentro}
      </button>
    </div>
  );
}
