import { describe, expect, test } from "vitest";
import {
  fromDonation,
  buildRecibirItems,
  recepcionResumen,
  resolveScanTarget,
  type ScannedItem,
} from "./recepcion";
import type { DonationItem } from "./donation";

const donacion: DonationItem[] = [
  { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 },
  { nombre: "Mantas", categoria: "ROPA", cantidad: 2 },
];

describe("recepción de donación escaneada", () => {
  test("fromDonation marca los items como no validados", () => {
    const items = fromDonation(donacion);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.validado === false)).toBe(true);
    expect(items[0]).toMatchObject({ nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 });
  });

  test("buildRecibirItems incluye solo los validados, sin el flag", () => {
    const items: ScannedItem[] = [
      { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5, validado: true },
      { nombre: "Mantas", categoria: "ROPA", cantidad: 2, validado: false },
    ];
    expect(buildRecibirItems(items)).toEqual([
      { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 },
    ]);
  });

  test("recepcionResumen cuenta unidades y categorías de los validados", () => {
    const items: ScannedItem[] = [
      { nombre: "Agua", categoria: "AGUA", cantidad: 5, validado: true },
      { nombre: "Jugo", categoria: "AGUA", cantidad: 3, validado: true },
      { nombre: "Mantas", categoria: "ROPA", cantidad: 2, validado: true },
      { nombre: "Pendiente", categoria: "ALIMENTOS", cantidad: 9, validado: false },
    ];
    // validados: 5+3+2 = 10 unidades; categorías distintas: AGUA, ROPA = 2
    expect(recepcionResumen(items)).toEqual({ unidades: 10, categorias: 2 });
  });

  test("resumen ignora categoría null para el conteo de categorías", () => {
    const items: ScannedItem[] = [
      { nombre: "Varios", categoria: null, cantidad: 4, validado: true },
      { nombre: "Agua", categoria: "AGUA", cantidad: 1, validado: true },
    ];
    expect(recepcionResumen(items)).toEqual({ unidades: 5, categorias: 1 });
  });

  test("sin validados: payload vacío y resumen en cero", () => {
    const items: ScannedItem[] = [
      { nombre: "Agua", categoria: "AGUA", cantidad: 5, validado: false },
    ];
    expect(buildRecibirItems(items)).toEqual([]);
    expect(recepcionResumen(items)).toEqual({ unidades: 0, categorias: 0 });
  });
});

describe("resolveScanTarget — centro por contexto", () => {
  const centros = [{ id: "a" }, { id: "b" }];

  test("con centro en URL y soy voluntario → escanea ese centro", () => {
    expect(resolveScanTarget(centros, "a")).toEqual({ kind: "scan", centroId: "a" });
  });

  test("con centro en URL pero NO soy voluntario → none", () => {
    expect(resolveScanTarget(centros, "z")).toEqual({ kind: "none" });
  });

  test("sin centro y 1 solo → redirige a ese centro", () => {
    expect(resolveScanTarget([{ id: "solo" }], null)).toEqual({
      kind: "redirect",
      to: "/scanning?centro=solo",
    });
  });

  test("sin centro y varios → redirige a Mi Centro", () => {
    expect(resolveScanTarget(centros, null)).toEqual({ kind: "redirect", to: "/mis-centros" });
  });

  test("sin centro y ninguno → none", () => {
    expect(resolveScanTarget([], null)).toEqual({ kind: "none" });
  });
});
