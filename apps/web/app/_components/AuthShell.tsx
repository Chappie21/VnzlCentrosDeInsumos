"use client";

import type { ReactNode } from "react";
import TopAppBar from "./TopAppBar";

// Layout de tarjeta centrada + créditos, compartido por la pantalla de inicio
// (intención / perfil) y la de login.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <TopAppBar />

      <main className="mx-auto flex w-full max-w-[1024px] flex-grow items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-md space-y-8 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-primary-container opacity-10"
          />
          {children}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1024px] px-4 pb-4 text-center text-sm text-on-surface-variant">
        <p>
          Iniciativa por{" "}
          <a
            href="https://build4venezuela.com/es"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary-container underline hover:no-underline"
          >
            Build4Venezuela
          </a>
        </p>
        <p className="mt-2 text-base font-medium">🇻🇪 Dios bendiga a Venezuela 🙏</p>
      </footer>
    </div>
  );
}

export function StatusFooter() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-outline-variant pt-4">
      <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        Sistema Activo
      </span>
    </div>
  );
}
