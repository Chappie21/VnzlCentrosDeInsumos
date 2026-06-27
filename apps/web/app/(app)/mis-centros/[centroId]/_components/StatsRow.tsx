import { Icon } from "../../../../_components";
import { STATS } from "../../../../constants";
import type { CentroDetalle } from "../../../../lib/api";

function Stat({ icon, valor, label }: { icon: string; valor: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <Icon name={icon} className="text-on-surface-variant" />
      <span className="mt-1 text-xl font-bold text-on-surface">{valor}</span>
      <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">{label}</span>
    </div>
  );
}

// Recuadros resumen del dashboard. "Items críticos" = insumos en nivel URGENTE.
export default function StatsRow({ centro }: { centro: CentroDetalle }) {
  const criticos = centro.insumos.filter((i) => i.nivel === "URGENTE").length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat icon="inventory_2" valor={centro.insumos.length} label={STATS.insumos} />
      <Stat icon="volunteer_activism" valor={centro.donaciones} label={STATS.donaciones} />
      <Stat icon="group" valor={centro.voluntarios} label={STATS.voluntarios} />
      <Stat icon="priority_high" valor={criticos} label={STATS.criticos} />
    </div>
  );
}
