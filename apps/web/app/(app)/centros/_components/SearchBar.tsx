"use client";

import { Icon } from "../../../_components";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Buscar por ciudad o nombre...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
        <Icon name="search" />
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-14 w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-base text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:border-emergency focus:outline-none focus:ring-1 focus:ring-emergency"
      />
    </div>
  );
}
