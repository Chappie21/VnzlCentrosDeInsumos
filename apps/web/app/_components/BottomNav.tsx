"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { NAV_TABS } from "../constants";
import { hasFullIdentity } from "../lib/identity";

// Navegación inferior global. Las tabs `requiresIdentity` se ocultan a quien no
// tiene identidad completa (anónimo "solo observar").
export default function BottomNav() {
  const pathname = usePathname();
  // hasFullIdentity lee localStorage -> resolver tras montar para no romper hidratación.
  const [fullIdentity, setFullIdentity] = useState(false);
  useEffect(() => setFullIdentity(hasFullIdentity()), []);

  const tabs = NAV_TABS.filter((t) => !t.requiresIdentity || fullIdentity);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-16 w-full max-w-[1024px] items-center justify-around border-t-2 border-outline-variant bg-surface">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-all active:scale-90 ${
              active
                ? "rounded-xl bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <Icon name={t.icon} filled={active} />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
