"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, Icon, Qr } from "../../../_components";
import { ROUTES } from "../../../constants";
import { hasFullIdentity, syncIdentity } from "../../../lib/identity";
import {
  getMisCentros,
  getCentrosSelect,
  crearEnvio,
  type MiCentro,
  type CentroLite,
} from "../../../lib/api";
import { buildEnvioItems, totalBultos, envioValido, type EnvioFormItem } from "../../../lib/envio";

type Phase = "loading" | "none" | "form" | "done";

function NuevoEnvio() {
  const router = useRouter();
  const centroParam = useSearchParams().get("centro");

  const [phase, setPhase] = useState<Phase>("loading");
  const [origen, setOrigen] = useState<MiCentro | null>(null);
  const [destinos, setDestinos] = useState<CentroLite[]>([]);
  const [items, setItems] = useState<EnvioFormItem[]>([]);

  const [destinoMode, setDestinoMode] = useState<"centro" | "texto">("centro");
  const [destinoCentroId, setDestinoCentroId] = useState("");
  const [destinoTexto, setDestinoTexto] = useState("");
  const [transporte, setTransporte] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envioId, setEnvioId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => setBaseUrl(window.location.origin), []);

  useEffect(() => {
    (async () => {
      const ok = hasFullIdentity() || (await syncIdentity()) != null;
      if (!ok) {
        router.replace(`/login?next=${encodeURIComponent("/envios/nuevo")}`);
        return;
      }
      try {
        const [mios, todos] = await Promise.all([getMisCentros(), getCentrosSelect()]);
        const o = mios.find((c) => c.id === centroParam);
        if (!o) {
          setPhase("none");
          return;
        }
        setOrigen(o);
        setItems(
          o.insumos.map((i) => ({
            insumoId: i.id,
            nombre: i.nombre,
            cantidadTotal: i.cantidadTotal,
            cantidad: 0,
          })),
        );
        setDestinos(todos.filter((c) => c.id !== o.id));
        setPhase("form");
      } catch {
        setPhase("none");
      }
    })();
  }, [centroParam, router]);

  const destinoCentroIdEff = destinoMode === "centro" ? destinoCentroId : "";
  const destinoTextoEff = destinoMode === "texto" ? destinoTexto : "";
  const valido = envioValido({
    destinoCentroId: destinoCentroIdEff,
    destinoTexto: destinoTextoEff,
    transporte,
    items,
  });
  const bultos = totalBultos(items);

  function setCantidad(idx: number, cantidad: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, cantidad: Math.max(0, Math.min(it.cantidadTotal, cantidad)) } : it,
      ),
    );
  }

  async function generar() {
    if (!origen || !valido) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await crearEnvio({
        centroId: origen.id,
        centroDestinoId: destinoMode === "centro" ? destinoCentroId : undefined,
        destinoTexto: destinoMode === "texto" ? destinoTexto.trim() : undefined,
        transporte: transporte.trim(),
        items: buildEnvioItems(items),
      });
      setEnvioId(res.id);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el envío");
    } finally {
      setSubmitting(false);
    }
  }

  function descargarQr() {
    const svg = document.querySelector("#guia-qr svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guia-${envioId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (phase === "loading") {
    return <p className="py-12 text-center text-on-surface-variant">Cargando…</p>;
  }

  if (phase === "none") {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <Icon name="error_outline" className="text-4xl text-on-surface-variant" />
        <p className="mt-2 text-on-surface-variant">
          No sos voluntario de ese centro, o no se especificó uno.
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.misCentros)}
          className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-on-surface-variant hover:bg-surface-container"
        >
          Ir a Mis Centros
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const destinoNombre =
      destinoMode === "centro"
        ? destinos.find((c) => c.id === destinoCentroId)?.nombre ?? "Centro"
        : destinoTexto.trim();
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-8 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check_circle" filled className="text-5xl" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-on-surface">Envío confirmado</h2>
          <p className="text-on-surface-variant">La carga fue despachada con éxito.</p>
        </div>

        <div id="guia-qr" className="mx-auto w-fit rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <Qr value={`${baseUrl}/guia/${envioId}`} />
        </div>

        <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left text-sm">
          <p className="font-mono text-xs text-on-surface-variant">ID: {envioId}</p>
          <p className="text-on-surface">
            <span className="text-on-surface-variant">Destino:</span> {destinoNombre}
          </p>
          <p className="text-on-surface">
            <span className="text-on-surface-variant">Bultos:</span> {bultos}
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={descargarQr}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white hover:bg-[#5a4a26] active:scale-[0.98]"
          >
            <Icon name="download" />
            Descargar QR
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.misCentros)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          >
            Ir a Mis Centros
          </button>
        </div>
      </div>
    );
  }

  // form
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <div>
        <h2 className="text-2xl font-semibold text-on-surface">Nuevo Envío de Ayuda</h2>
        {origen && (
          <p className="mt-1 text-on-surface-variant">
            Despacho desde <strong>{origen.nombre}</strong>
          </p>
        )}
      </div>

      {/* Destino */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Destino</p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={destinoMode === "centro"}
            onClick={() => setDestinoMode("centro")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${destinoMode === "centro" ? "border-emergency bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant"}`}
          >
            Centro de la red
          </button>
          <button
            type="button"
            aria-pressed={destinoMode === "texto"}
            onClick={() => setDestinoMode("texto")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${destinoMode === "texto" ? "border-emergency bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant"}`}
          >
            Otro (albergue)
          </button>
        </div>
        {destinoMode === "centro" ? (
          <select
            aria-label="Centro destino"
            value={destinoCentroId}
            onChange={(e) => setDestinoCentroId(e.target.value)}
            className="block w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-3 text-base text-on-surface focus:border-safety focus:outline-none"
          >
            <option value="">Seleccionar centro…</option>
            {destinos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {c.ciudad}
              </option>
            ))}
          </select>
        ) : (
          <Field
            label="Destino (texto libre)"
            icon="location_on"
            placeholder="Ej. Albergue Regional Sur"
            value={destinoTexto}
            onChange={(e) => setDestinoTexto(e.target.value)}
          />
        )}
      </div>

      {/* Items a despachar */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Insumos a despachar
        </p>
        {items.length === 0 && (
          <p className="text-sm text-on-surface-variant">Este centro no tiene inventario.</p>
        )}
        {items.map((it, idx) => (
          <div
            key={it.insumoId}
            className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-on-surface">{it.nombre}</p>
              <p className="text-xs text-on-surface-variant">stock: {it.cantidadTotal}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Restar ${it.nombre}`}
                onClick={() => setCantidad(idx, it.cantidad - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high"
              >
                <Icon name="remove" />
              </button>
              <input
                type="number"
                min={0}
                max={it.cantidadTotal}
                aria-label={`Cantidad ${it.nombre}`}
                value={it.cantidad}
                onChange={(e) => setCantidad(idx, Math.floor(Number(e.target.value) || 0))}
                className="h-9 w-14 rounded-lg border-2 border-outline-variant bg-surface text-center text-on-surface focus:border-safety focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Sumar ${it.nombre}`}
                onClick={() => setCantidad(idx, it.cantidad + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high"
              >
                <Icon name="add" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Transporte */}
      <Field
        label="Transporte / chofer"
        icon="local_shipping"
        placeholder="Ej. Juan Pérez"
        value={transporte}
        onChange={(e) => setTransporte(e.target.value)}
      />

      <div className="flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="text-on-surface-variant">Total bultos:</span>
        <span className="text-xl font-bold text-on-surface">{bultos}</span>
      </div>

      {error && <p className="text-sm text-emergency">{error}</p>}

      <button
        type="button"
        disabled={!valido || submitting}
        onClick={generar}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action font-semibold text-white shadow-sm transition-colors hover:bg-[#5a4a26] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="send" />
        {submitting ? "Generando…" : "Generar Guía de Envío"}
      </button>
    </div>
  );
}

export default function NuevoEnvioPage() {
  return (
    <Suspense fallback={null}>
      <NuevoEnvio />
    </Suspense>
  );
}
