import { describe, it, expect } from "vitest";
import { detectColumns, matchCategoria, rowsToItems, MAX_FILAS } from "./excel";

describe("detectColumns", () => {
  it("encuentra columnas por sinónimos", () => {
    expect(detectColumns(["Producto", "Stock", "Tipo"])).toEqual({
      nombre: 0,
      cantidad: 1,
      categoria: 2,
    });
  });

  it("encuentra encabezados acentuados (Categoría)", () => {
    expect(detectColumns(["Descripción", "Unidades", "Categoría"])).toEqual({
      nombre: 0,
      cantidad: 1,
      categoria: 2,
    });
  });

  it("devuelve null cuando no hay coincidencia", () => {
    expect(detectColumns(["foo", "bar"])).toEqual({
      nombre: null,
      cantidad: null,
      categoria: null,
    });
  });
});

describe("matchCategoria", () => {
  it("mapea valores acentuados/minúsculas al enum", () => {
    expect(matchCategoria("agua")).toBe("AGUA");
    expect(matchCategoria("Medicamentos")).toBe("MEDICAMENTOS");
  });
  it("devuelve '' si no coincide", () => {
    expect(matchCategoria("xyz")).toBe("");
    expect(matchCategoria("")).toBe("");
  });
});

describe("rowsToItems", () => {
  const mapping = { nombre: 0, cantidad: 1, categoria: 2 };

  it("coacciona cantidad a entero >= 0", () => {
    const filas = [
      ["Nombre", "Cant", "Cat"],
      ["Agua", "abc", "agua"],
      ["Mantas", "3.7", "ropa"],
      ["Gasas", "-5", ""],
    ];
    const { items } = rowsToItems(filas, mapping, 0);
    expect(items[0].cantidad).toBe(0);
    expect(items[1].cantidad).toBe(3);
    expect(items[2].cantidad).toBe(0);
  });

  it("mapea categoría y respeta categoria=null", () => {
    const filas = [
      ["Nombre", "Cant", "Cat"],
      ["Agua", "2", "agua"],
    ];
    expect(rowsToItems(filas, mapping, 0).items[0].categoria).toBe("AGUA");
    expect(rowsToItems(filas, { ...mapping, categoria: null }, 0).items[0].categoria).toBe("");
  });

  it("salta filas con nombre vacío", () => {
    const filas = [
      ["Nombre", "Cant", "Cat"],
      ["", "2", "agua"],
      ["Agua", "2", "agua"],
    ];
    const { items } = rowsToItems(filas, mapping, 0);
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe("Agua");
  });

  it("respeta headerIdx (ignora filas previas al encabezado)", () => {
    const filas = [
      ["Reporte de inventario", "", ""],
      ["Nombre", "Cant", "Cat"],
      ["Agua", "2", "agua"],
    ];
    const { items } = rowsToItems(filas, mapping, 1);
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe("Agua");
  });

  it("topa en MAX_FILAS y marca truncado", () => {
    const filas: string[][] = [["Nombre", "Cant", "Cat"]];
    for (let i = 0; i < MAX_FILAS + 10; i++) filas.push([`Item ${i}`, "1", "agua"]);
    const { items, truncado } = rowsToItems(filas, mapping, 0);
    expect(items).toHaveLength(MAX_FILAS);
    expect(truncado).toBe(true);
  });
});
