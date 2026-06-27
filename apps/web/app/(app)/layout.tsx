"use client";

import { useEffect, type ReactNode } from "react";
import { TopAppBar, BottomNav } from "../_components";
import { syncIdentity } from "../lib/identity";

// Chrome compartido de las vistas autenticadas (y públicas como el directorio):
// TopAppBar arriba, BottomNav abajo. El directorio es público, así que NO se redirige;
// las tabs de operador se ocultan en BottomNav según la identidad.
export default function AppLayout({ children }: { children: ReactNode }) {
  // Rehidrata identidad desde el backend si se limpió localStorage (no bloquea el render).
  useEffect(() => {
    void syncIdentity();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <TopAppBar />
      <main className="mx-auto w-full max-w-[1024px] flex-grow px-4 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
