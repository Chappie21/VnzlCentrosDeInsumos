import { describe, expect, test } from "vitest";
import { parseInventarioRows, mapCategoria } from "./inventario-import";

describe("import de inventario", () => {
  test("mapCategoria: sinónimos, acentos y case → enum", () => {
    expect(mapCategoria("Hidratación")).toBe("AGUA");
    expect(mapCategoria("agua")).toBe("AGUA");
    expect(mapCategoria("COMIDA")).toBe("ALIMENTOS");
    expect(mapCategoria("Insumos médicos")).toBe("MEDICAMENTOS");
    expect(mapCategoria("ropa")).toBe("ROPA");
    expect(mapCategoria("Herramientas")).toBe("HERRAMIENTAS");
    expect(mapCategoria("AGUA")).toBe("AGUA"); // valor del enum directo
    expect(mapCategoria("oro")).toBeNull();
    expect(mapCategoria("")).toBeNull();
    expect(mapCategoria(undefined)).toBeNull();
  });

  test("parsea filas válidas con keys flexibles (Nombre/Categoría/Cantidad)", () => {
    const { items, warnings } = parseInventarioRows([
      { Nombre: "Agua embotellada", "Categoría": "Hidratación", Cantidad: "5" },
      { nombre: "Arroz", categoria: "comida", cantidad: 12 },
    ]);
    expect(warnings).toEqual([]);
    expect(items).toEqual([
      { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 },
      { nombre: "Arroz", categoria: "ALIMENTOS", cantidad: 12 },
    ]);
  });

  test("categoría no reconocida → null + warning (no rompe la fila)", () => {
    const { items, warnings } = parseInventarioRows([
      { nombre: "Varios", categoria: "oro", cantidad: 2 },
    ]);
    expect(items).toEqual([{ nombre: "Varios", categoria: null, cantidad: 2 }]);
    expect(warnings.some((w) => /categor/i.test(w))).toBe(true);
  });

  test("nombre vacío → fila omitida + warning", () => {
    const { items, warnings } = parseInventarioRows([
      { nombre: "  ", categoria: "agua", cantidad: 3 },
    ]);
    expect(items).toEqual([]);
    expect(warnings.some((w) => /nombre/i.test(w))).toBe(true);
  });

  test("cantidad inválida (texto o < 1) → omitida + warning", () => {
    const { items, warnings } = parseInventarioRows([
      { nombre: "A", categoria: "agua", cantidad: "x" },
      { nombre: "B", categoria: "agua", cantidad: 0 },
    ]);
    expect(items).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  test("cantidad decimal → se trunca", () => {
    const { items } = parseInventarioRows([{ nombre: "A", categoria: "agua", cantidad: 5.9 }]);
    expect(items[0].cantidad).toBe(5);
  });

  test("ignora filas totalmente vacías sin avisar", () => {
    const { items, warnings } = parseInventarioRows([{}, { nombre: "", categoria: "", cantidad: "" }]);
    expect(items).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
