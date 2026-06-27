import { Icon } from "../../../_components";
import {
  NIVEL_BADGE,
  CATEGORIA_ICON,
  CATEGORIA_ICON_FALLBACK,
} from "../../../constants";
import type { Necesidad } from "../../../_hooks";

// Badge de necesidad: color por nivel, ícono por categoría.
export default function NeedBadge({ necesidad }: { necesidad: Necesidad }) {
  const color = NIVEL_BADGE[necesidad.nivel] ?? NIVEL_BADGE.NORMAL;
  const icon =
    (necesidad.categoria && CATEGORIA_ICON[necesidad.categoria]) ??
    CATEGORIA_ICON_FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-badge px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${color}`}
    >
      <Icon name={icon} className="text-[14px]" />
      {necesidad.nombre}
    </span>
  );
}
