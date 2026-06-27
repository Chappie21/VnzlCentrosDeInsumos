"use client";

import Icon from "./Icon";

// Barra superior compartida (menu · RESPONSE CORE · emergency).
export default function TopAppBar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-50 mx-auto flex h-12 w-full max-w-[1024px] items-center justify-between border-b-2 border-outline-variant bg-surface px-4">
      <button
        type="button"
        aria-label="Menú"
        onClick={onMenu}
        className="flex h-12 w-12 items-center justify-center rounded-full text-emergency transition-colors hover:bg-surface-container-high active:scale-95"
      >
        <Icon name="menu" />
      </button>
      <h1 className="text-xl font-bold uppercase tracking-tight text-emergency">
        RESPONSE CORE
      </h1>
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full text-emergency"
      >
        <Icon name="emergency" />
      </span>
    </header>
  );
}
