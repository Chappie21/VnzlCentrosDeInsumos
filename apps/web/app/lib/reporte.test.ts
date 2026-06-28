import { describe, expect, test } from "vitest";
import { distribucionPorCategoria, totalInsumos } from "./reporte";

describe("totalInsumos", () => {
  test("suma las cantidades", () => {
    expect(totalInsumos([{ cantidadTotal: 3 }, { cantidadTotal: 5 }])).toBe(8);
  });

  test("array vacío → 0", () => {
    expect(totalInsumos([])).toBe(0);
  });
});

describe("distribucionPorCategoria", () => {
  test("agrupa, suma y calcula % usando labels de CATEGORIAS", () => {
    const dist = distribucionPorCategoria([
      { categoria: "AGUA", cantidadTotal: 10 },
      { categoria: "AGUA", cantidadTotal: 30 },
      { categoria: "MEDICAMENTOS", cantidadTotal: 60 },
    ]);

    // Ordenado desc por cantidad: MEDICAMENTOS (60) antes que AGUA (40).
    expect(dist.map((d) => d.categoria)).toEqual(["MEDICAMENTOS", "AGUA"]);
    expect(dist[0]).toMatchObject({ label: "Medicamentos", cantidad: 60, pct: 60 });
    expect(dist[1]).toMatchObject({ label: "Agua", cantidad: 40, pct: 40 });
  });

  test("categoria null → grupo 'Sin categoría'", () => {
    const dist = distribucionPorCategoria([
      { categoria: null, cantidadTotal: 5 },
      { categoria: "ROPA", cantidadTotal: 5 },
    ]);
    const sin = dist.find((d) => d.label === "Sin categoría");
    expect(sin).toBeTruthy();
    expect(sin?.cantidad).toBe(5);
  });

  test("array vacío → sin grupos y sin NaN", () => {
    expect(distribucionPorCategoria([])).toEqual([]);
  });

  test("total 0 → pct 0 (sin NaN)", () => {
    const dist = distribucionPorCategoria([{ categoria: "AGUA", cantidadTotal: 0 }]);
    expect(dist[0].pct).toBe(0);
  });
});
