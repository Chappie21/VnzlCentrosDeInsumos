// Item del form de Nuevo Envío: un insumo del origen con la cantidad a despachar.
export type EnvioFormItem = {
  insumoId: string;
  nombre: string;
  cantidadTotal: number; // stock disponible en el origen
  cantidad: number; // a despachar (0..cantidadTotal)
};

// Payload para POST /envios: solo los items con cantidad > 0.
export function buildEnvioItems(items: EnvioFormItem[]): { insumoId: string; cantidad: number }[] {
  return items
    .filter((i) => i.cantidad > 0)
    .map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad }));
}

export function totalBultos(items: EnvioFormItem[]): number {
  return items.reduce((sum, i) => sum + (i.cantidad > 0 ? i.cantidad : 0), 0);
}

// Habilita "Generar Guía": destino (centro XOR texto), transporte, y al menos un
// item con cantidad válida (>0 y dentro del stock).
export function envioValido(opts: {
  destinoCentroId?: string;
  destinoTexto?: string;
  transporte: string;
  items: EnvioFormItem[];
}): boolean {
  const tieneCentro = Boolean(opts.destinoCentroId);
  const tieneTexto = Boolean(opts.destinoTexto?.trim());
  if (tieneCentro === tieneTexto) return false; // ni uno ni los dos
  if (!opts.transporte.trim()) return false;
  const aDespachar = opts.items.filter((i) => i.cantidad > 0);
  if (aDespachar.length === 0) return false;
  return aDespachar.every((i) => i.cantidad <= i.cantidadTotal);
}
