"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "../../../../_components";
import { ROUTES } from "../../../../constants";
import { cargaInicial } from "../../../../lib/api";
import type { DonationItem } from "../../../../lib/donation";
import CargaInventario from "./_components/CargaInventario";

export default function CargarInventarioPage() {
  const params = useParams<{ centroId: string }>();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cargados, setCargados] = useState(0);

  async function confirmar(items: DonationItem[]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await cargaInicial(params.centroId, items);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        setError(msg || "No se pudo cargar el inventario. ¿Sos miembro del centro?");
        return;
      }
      setCargados(items.length);
      setDone(true);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Icon name="check_circle" filled className="text-4xl" />
        </div>
        <p className="text-on-surface">
          {cargados} {cargados === 1 ? "insumo cargado" : "insumos cargados"} como inventario inicial.
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.misCentroDetalle(params.centroId))}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white hover:bg-[#b70011]"
        >
          Ver el centro
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <div>
        <h2 className="text-2xl font-semibold text-on-surface">Inventario inicial</h2>
        <p className="mt-1 text-on-surface-variant">
          Cargá lo que el centro ya tiene al registrarse: a mano o importando un Excel/CSV
          (columnas: nombre, categoría, cantidad). Esto se hace una sola vez; después el stock
          se mueve por recepción y envíos.
        </p>
      </div>
      {error && <p className="text-sm text-emergency">{error}</p>}
      <CargaInventario onConfirmar={confirmar} submitting={submitting} />
    </div>
  );
}
