import { Icon } from "../../../../_components";
import type { Guia } from "../../../../lib/api";

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-VE");
};

function destinoLabel(destino: Guia["destino"]): string {
  return "nombre" in destino ? `${destino.nombre} — ${destino.ciudad}` : destino.texto ?? "—";
}

// Vista de la guía de envío (presentacional). La usa la página pública /guia/:id.
export default function GuiaView({ guia }: { guia: Guia }) {
  const bultos = guia.items.reduce((sum, i) => sum + i.cantidad, 0);

  // Transporte y "Despachado por" son PII: el backend solo los envía al JEFE del
  // centro origen/destino. Si vienen, se muestran; si no, se omiten esas filas.
  const filas: { label: string; value: string }[] = [
    { label: "Origen", value: `${guia.origen.nombre} — ${guia.origen.ciudad}` },
    { label: "Destino", value: destinoLabel(guia.destino) },
    ...(guia.transporte !== undefined
      ? [{ label: "Transporte", value: guia.transporte }]
      : []),
    ...(guia.despachadoPor !== undefined
      ? [{ label: "Despachado por", value: guia.despachadoPor ?? "—" }]
      : []),
    { label: "Fecha", value: fmtFecha(guia.creadoEn) },
  ];

  return (
    <article className="space-y-6">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 text-emergency">
          <Icon name="local_shipping" filled />
          <span className="text-sm font-bold uppercase tracking-wider">Guía de carga</span>
        </div>
        <p className="mt-1 font-mono text-xs text-on-surface-variant">ID: {guia.id}</p>
      </header>

      <dl className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {f.label}
            </dt>
            <dd className="text-right text-on-surface">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Artículos
        </p>
        <ul className="space-y-2">
          {guia.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="inline-flex min-w-9 justify-center rounded bg-emergency px-2 py-1 text-sm font-bold text-white">
                {it.cantidad}×
              </span>
              <span className="text-on-surface">{it.nombre}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
          <span className="text-on-surface-variant">Total bultos:</span>
          <span data-testid="total-bultos" className="text-xl font-bold text-on-surface">
            {bultos}
          </span>
        </div>
      </div>
    </article>
  );
}
