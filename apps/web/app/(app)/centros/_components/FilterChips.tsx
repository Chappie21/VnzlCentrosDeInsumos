"use client";

import { Icon } from "../../../_components";
import { FILTER_CHIPS, type FilterId } from "../../../constants";

function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "border-emergency bg-primary-container text-on-primary-container"
          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
      }`}
    >
      <Icon name={icon} className="text-[16px]" />
      {label}
    </button>
  );
}

export default function FilterChips({
  active,
  onToggle,
}: {
  active: Record<FilterId, boolean>;
  onToggle: (id: FilterId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTER_CHIPS.map((c) => (
        <Chip
          key={c.id}
          label={c.label}
          icon={c.icon}
          active={active[c.id]}
          onClick={() => onToggle(c.id)}
        />
      ))}
    </div>
  );
}
