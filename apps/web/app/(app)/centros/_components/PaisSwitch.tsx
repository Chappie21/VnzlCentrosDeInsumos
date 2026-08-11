"use client";

import { PAISES, PAIS_META, type Pais } from "@vnzl/paises";

type Props = {
  value: Pais;
  onChange: (pais: Pais) => void;
};

// Segmented control de 2 botones. Fuera del sistema de chips a propósito: esos
// son toggles booleanos independientes y el país es una elección excluyente.
export default function PaisSwitch({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="País"
      className="inline-flex rounded-full border border-outline-variant bg-surface-container-lowest p-1"
    >
      {PAISES.map((p) => {
        const activo = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={activo}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              activo
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {PAIS_META[p].bandera} {PAIS_META[p].label}
          </button>
        );
      })}
    </div>
  );
}
