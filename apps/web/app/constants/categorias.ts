// Espejo del enum CategoriaInsumo del backend (packages/database). Web no importa
// el cliente Prisma para no bundlearlo; si el enum cambia, actualizar acá.
export const CATEGORIAS = [
  { value: "AGUA", label: "Agua", icon: "water_drop" },
  { value: "ALIMENTOS", label: "Alimentos", icon: "restaurant" },
  { value: "MEDICAMENTOS", label: "Medicamentos", icon: "medication" },
  { value: "ROPA", label: "Ropa", icon: "checkroom" },
  { value: "HERRAMIENTAS", label: "Herramientas", icon: "build" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["value"];

export const CATEGORIA_VALUES: readonly Categoria[] = CATEGORIAS.map((c) => c.value);
