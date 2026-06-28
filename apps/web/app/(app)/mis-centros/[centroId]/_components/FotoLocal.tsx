"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../../_components";
import { API, subirFoto, type CentroDetalle } from "../../../../lib/api";
import { centrosKeys } from "../../../../constants";
import { comprimirImagen } from "../../../../lib/image";

// Foto del local/cartel (evidencia para verificar el centro). El JEFE la sube;
// cualquier miembro la ve. Se comprime en el cliente y va como base64.
export default function FotoLocal({ centro }: { centro: CentroDetalle }) {
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esJefe = centro.rol === "JEFE";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const dataUrl = await comprimirImagen(file);
      await subirFoto(centro.id, dataUrl);
      await qc.invalidateQueries({ queryKey: centrosKeys.detalle(centro.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  }

  if (!esJefe && !centro.fotoUrl) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        Foto del local
      </h2>
      {centro.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${API}${centro.fotoUrl}`}
          alt="Local del centro"
          className="h-44 w-full rounded-lg border border-outline-variant object-cover"
        />
      ) : (
        <p className="text-sm text-on-surface-variant">
          Subí una foto del local o cartel — ayuda al equipo a verificar el centro.
        </p>
      )}
      {esJefe && (
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high">
          <Icon name="photo_camera" />
          {subiendo ? "Subiendo…" : centro.fotoUrl ? "Cambiar foto" : "Subir foto del local"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
            disabled={subiendo}
          />
        </label>
      )}
      {error && <p className="text-sm text-emergency">{error}</p>}
    </section>
  );
}
