"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "../../../../_components";
import { ROUTES } from "../../../../constants";
import { recibirDonacion } from "../../../../lib/api";
import type { DonationItem } from "../../../../lib/donation";
import CargaInventario from "./_components/CargaInventario";

export default function CargarInventarioPage() {
  const params = useParams<{ centroId: string }>();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cargados, setCargados] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  async function confirmar(items: DonationItem[]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await recibirDonacion(params.centroId, items);
      if (!res.ok) {
        setError("No se pudo cargar el inventario. ¿Sos miembro del centro?");
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
          {cargados} {cargados === 1 ? "insumo cargado" : "insumos cargados"} al inventario.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.misCentroDetalle(params.centroId))}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white hover:bg-[#b70011]"
          >
            Ver el centro
          </button>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setResetKey((k) => k + 1);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          >
            Cargar más
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <div>
        <h2 className="text-2xl font-semibold text-on-surface">Cargar inventario</h2>
        <p className="mt-1 text-on-surface-variant">
          Agregá los insumos a mano o importá un Excel/CSV (columnas: nombre, categoría, cantidad).
        </p>
      </div>
      {error && <p className="text-sm text-emergency">{error}</p>}
      <CargaInventario key={resetKey} onConfirmar={confirmar} submitting={submitting} />
    </div>
  );
}
