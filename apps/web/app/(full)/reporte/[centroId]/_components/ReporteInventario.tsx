import type { CentroDetalle, VoluntarioItem } from "../../../../lib/api";
import { distribucionPorCategoria, totalInsumos } from "../../../../lib/reporte";
import { CATEGORIAS } from "../../../../constants";

// Mapa categoria(enum) → label para la tabla de inventario.
const LABEL = new Map<string, string>(CATEGORIAS.map((c) => [c.value, c.label]));
const GUION = "—";

const ROL_LABEL: Record<string, string> = { JEFE: "Jefe", VOLUNTARIO: "Voluntario" };

// Documento imprimible (papel / "Guardar como PDF"). Solo renderiza props:
// fondo blanco, texto oscuro y bordes simples para que se lea bien impreso.
export default function ReporteInventario({
  centro,
  voluntarios,
  instante,
}: {
  centro: CentroDetalle;
  voluntarios: VoluntarioItem[];
  instante: Date;
}) {
  const total = totalInsumos(centro.insumos);
  const distribucion = distribucionPorCategoria(centro.insumos);
  const fecha = new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(instante);

  return (
    <article className="mx-auto max-w-3xl bg-white p-6 text-sm text-gray-900 print:p-0">
      {/* Encabezado */}
      <header className="mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold">{centro.nombre}</h1>
        <p className="mt-1 text-gray-700">
          {centro.estado} · {centro.ciudad} · {centro.direccion}
        </p>
        <p className="mt-1 text-gray-700">Revisión de inventario: {fecha}</p>
      </header>

      {/* Personas a cargo */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Personas a cargo</h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1">Nombre</th>
              <th className="border border-gray-300 px-2 py-1">Cédula</th>
              <th className="border border-gray-300 px-2 py-1">Rol</th>
            </tr>
          </thead>
          <tbody>
            {voluntarios.map((v) => (
              <tr key={v.id}>
                <td className="border border-gray-300 px-2 py-1">{v.nombre ?? GUION}</td>
                <td className="border border-gray-300 px-2 py-1">{v.cedula ?? GUION}</td>
                <td className="border border-gray-300 px-2 py-1">{ROL_LABEL[v.rol] ?? v.rol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Inventario */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Inventario</h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1">Insumo</th>
              <th className="border border-gray-300 px-2 py-1">Categoría</th>
              <th className="border border-gray-300 px-2 py-1 text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {centro.insumos.map((i) => (
              <tr key={i.id}>
                <td className="border border-gray-300 px-2 py-1">{i.nombre}</td>
                <td className="border border-gray-300 px-2 py-1">
                  {(i.categoria && LABEL.get(i.categoria)) ?? "Sin categoría"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{i.cantidadTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Total destacado */}
      <section className="mb-6">
        <p className="text-lg">
          Total de insumos: <span className="font-bold">{total}</span>
        </p>
      </section>

      {/* Distribución por tipo */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Distribución por tipo</h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1">Tipo</th>
              <th className="border border-gray-300 px-2 py-1 text-right">Cantidad</th>
              <th className="border border-gray-300 px-2 py-1 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {distribucion.map((d) => (
              <tr key={d.categoria}>
                <td className="border border-gray-300 px-2 py-1">
                  {d.label}
                  {/* Barra CSS simple (sin librería de gráficos) */}
                  <span className="mt-1 block h-1.5 w-full bg-gray-200">
                    <span
                      className="block h-full bg-gray-700"
                      style={{ width: `${d.pct}%` }}
                    />
                  </span>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{d.cantidad}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {d.pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}
