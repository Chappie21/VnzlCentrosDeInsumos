"use client";

import { useState } from "react";
import { Icon } from "../../../_components";
import type { MotivoReporte } from "../../../lib/api";

const MOTIVOS: { value: MotivoReporte; label: string; icon: string }[] = [
  { value: "NO_EXISTE", label: "Ya no está", icon: "location_off" },
  { value: "INFO_INCORRECTA", label: "Info incorrecta", icon: "edit_note" },
  { value: "ENGANOSO", label: "Engañoso / falso", icon: "report" },
];

export default function ReportarSheet({
  nombre,
  onConfirmar,
  onClose,
}: {
  nombre: string;
  onConfirmar: (motivo: MotivoReporte, comentario: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoReporte | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!motivo) return;
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo, comentario.trim());
      setEnviado(true);
    } catch {
      setError("No se pudo enviar el reporte. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {enviado ? (
          <div className="space-y-4 py-4 text-center">
            <Icon name="check_circle" filled className="text-4xl text-success" />
            <p className="text-on-surface">Gracias. El equipo lo revisará.</p>
            <button
              type="button"
              onClick={onClose}
              className="h-11 w-full rounded-lg bg-emergency font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Reportar centro</h2>
                <p className="text-sm text-on-surface-variant">{nombre}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={onClose} className="text-on-surface-variant">
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={motivo === m.value}
                  onClick={() => setMotivo(m.value)}
                  className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-3 text-left text-sm font-medium transition-colors ${
                    motivo === m.value
                      ? "border-emergency bg-emergency/5 text-on-surface"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <Icon name={m.icon} className="text-[20px]" />
                  {m.label}
                </button>
              ))}
            </div>

            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={280}
              placeholder="Comentario (opcional)"
              rows={2}
              className="w-full rounded-lg border-2 border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-emergency focus:outline-none"
            />

            {error && <p className="text-sm text-emergency">{error}</p>}

            <button
              type="button"
              disabled={!motivo || enviando}
              onClick={enviar}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-white disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Enviar reporte"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
