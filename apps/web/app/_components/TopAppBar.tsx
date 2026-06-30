"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { ROUTES } from "../constants";

// Barra superior compartida (menu · Red Acopio Venezuela · emergency).
// El burger abre un menú simple; hoy solo "Volver al inicio". onMenu queda como
// hook opcional por si algún contenedor quiere reaccionar a la apertura.
export default function TopAppBar({ onMenu }: { onMenu?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 mx-auto flex h-12 w-full max-w-[1024px] items-center justify-between border-b-2 border-outline-variant bg-surface px-4">
      <div className="relative">
        <button
          type="button"
          aria-label="Menú"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            onMenu?.();
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full text-emergency transition-colors hover:bg-surface-container-high active:scale-95"
        >
          <Icon name="menu" />
        </button>

        {open && (
          <>
            {/* Cierra al clickear fuera */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute left-0 top-12 z-50 min-w-52 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
              <Link
                href={ROUTES.home}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-on-surface hover:bg-surface-container-high"
              >
                <Icon name="home" />
                Volver al inicio
              </Link>
              <Link
                href={ROUTES.faq}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-on-surface hover:bg-surface-container-high"
              >
                <Icon name="help" />
                Ayuda / Cómo funciona
              </Link>
            </div>
          </>
        )}
      </div>

      <h1 className="min-w-0 flex-1 truncate text-center text-xl font-bold uppercase tracking-tight text-emergency">
        Red Acopio Venezuela
      </h1>
      <Link
        href={ROUTES.faq}
        aria-label="Ayuda"
        className="flex h-12 w-12 items-center justify-center rounded-full text-emergency transition-colors hover:bg-surface-container-high active:scale-95"
      >
        <Icon name="help" />
      </Link>
    </header>
  );
}
