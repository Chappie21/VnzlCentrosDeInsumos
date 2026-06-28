"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../../_components";
import { ROUTES } from "../../constants";
import { getMisCentros, recibirDonacion, type MiCentro } from "../../lib/api";
import { decodeDonation } from "../../lib/donation";
import {
  fromDonation,
  buildRecibirItems,
  resolveScanTarget,
  type ScannedItem,
} from "../../lib/recepcion";
import QrScanner from "./_components/QrScanner";
import RecepcionList from "./_components/RecepcionList";

type Phase = "loading" | "none" | "scan" | "review" | "done";

function Scanning() {
  const router = useRouter();
  const centroParam = useSearchParams().get("centro");

  const [phase, setPhase] = useState<Phase>("loading");
  const [centro, setCentro] = useState<MiCentro | null>(null);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recibidos, setRecibidos] = useState(0);

  // Resolver el centro por contexto (nunca dropdown al escanear).
  useEffect(() => {
    (async () => {
      try {
        const centros = await getMisCentros();
        const target = resolveScanTarget(centros, centroParam);
        if (target.kind === "redirect") {
          router.replace(target.to);
        } else if (target.kind === "none") {
          setPhase("none");
        } else {
          setCentro(centros.find((c) => c.id === target.centroId) ?? null);
          setPhase("scan");
        }
      } catch {
        setPhase("none");
      }
    })();
  }, [centroParam, router]);

  function handleScan(text: string) {
    try {
      const decoded = decodeDonation(text);
      setItems((prev) => [...prev, ...fromDonation(decoded)]);
      setScanError(null);
      setPhase("review");
    } catch {
      setScanError("El código no es una donación válida. Intentá de nuevo.");
    }
  }

  async function handleConfirm() {
    if (!centro) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await recibirDonacion(centro.id, buildRecibirItems(items));
      if (!res.ok) {
        setError("No se pudo registrar la donación. Intentá de nuevo.");
        return;
      }
      const data = await res.json();
      setRecibidos(data?.recibidos ?? 0);
      setItems([]);
      setPhase("done");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return <p className="py-12 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (phase === "none") {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <Icon name="error_outline" className="text-4xl text-on-surface-variant" />
        <p className="mt-2 text-on-surface-variant">
          No sos voluntario de ningún centro, o el centro no es válido.
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.centros)}
          className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-on-surface-variant hover:bg-surface-container"
        >
          Ir al directorio
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Icon name="check_circle" filled className="text-4xl" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-on-surface">Donación registrada</h2>
          <p className="mt-1 text-on-surface-variant">
            {recibidos}{" "}
            {recibidos === 1 ? "tipo de insumo ingresado" : "tipos de insumo ingresados"} en{" "}
            {centro?.nombre}.
          </p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setPhase("scan")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white hover:bg-[#9a2a28] active:scale-[0.98]"
          >
            <Icon name="qr_code_scanner" />
            Escanear otra donación
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.misCentros)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          >
            Ir a Mi Centro
          </button>
        </div>
      </div>
    );
  }

  // scan | review
  return (
    <div className="mx-auto max-w-md space-y-5 py-4">
      <div>
        <h2 className="text-2xl font-semibold text-on-surface">Escanear donación</h2>
        {centro && (
          <p className="mt-1 text-on-surface-variant">
            Recepción en <strong>{centro.nombre}</strong>
          </p>
        )}
      </div>

      {phase === "scan" ? (
        <>
          <QrScanner onScan={handleScan} />
          {scanError && <p className="text-sm text-emergency">{scanError}</p>}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setPhase("review")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 text-on-surface-variant hover:bg-surface-container"
            >
              Ver {items.length} item(s) escaneado(s)
            </button>
          )}
        </>
      ) : (
        <>
          <RecepcionList
            items={items}
            onChange={setItems}
            onConfirm={handleConfirm}
            submitting={submitting}
          />
          {error && <p className="text-sm text-emergency">{error}</p>}
          <button
            type="button"
            onClick={() => setPhase("scan")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="add" />
            Escanear más
          </button>
        </>
      )}
    </div>
  );
}

export default function ScanningPage() {
  return (
    <Suspense fallback={null}>
      <Scanning />
    </Suspense>
  );
}
