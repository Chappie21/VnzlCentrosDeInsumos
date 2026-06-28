"use client";

import Icon from "./Icon";

// Botón de acción flotante (esquina inferior derecha, sobre el BottomNav).
export default function Fab({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-action px-5 py-3 text-white shadow-lg transition-transform hover:bg-[#5a4a26] active:scale-95"
    >
      <Icon name={icon} />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
