import { describe, expect, test } from "vitest";
import {
  buildEnvioItems,
  totalBultos,
  envioValido,
  type EnvioFormItem,
} from "./envio";

const items: EnvioFormItem[] = [
  { insumoId: "i1", nombre: "Agua", cantidadTotal: 10, cantidad: 4 },
  { insumoId: "i2", nombre: "Mantas", cantidadTotal: 5, cantidad: 0 },
  { insumoId: "i3", nombre: "Atún", cantidadTotal: 8, cantidad: 2 },
];

describe("envío — lógica de despacho", () => {
  test("buildEnvioItems toma solo cantidad>0, mapea a {insumoId, cantidad}", () => {
    expect(buildEnvioItems(items)).toEqual([
      { insumoId: "i1", cantidad: 4 },
      { insumoId: "i3", cantidad: 2 },
    ]);
  });

  test("totalBultos suma las cantidades a despachar", () => {
    expect(totalBultos(items)).toBe(6);
  });

  test("válido: destino centro + transporte + al menos un item dentro de stock", () => {
    expect(
      envioValido({ destinoCentroId: "c2", destinoTexto: "", transporte: "Juan", items }),
    ).toBe(true);
  });

  test("válido con destino de texto (albergue)", () => {
    expect(
      envioValido({ destinoCentroId: "", destinoTexto: "Albergue Sur", transporte: "Juan", items }),
    ).toBe(true);
  });

  test("inválido: sin destino", () => {
    expect(
      envioValido({ destinoCentroId: "", destinoTexto: "  ", transporte: "Juan", items }),
    ).toBe(false);
  });

  test("inválido: destino centro Y texto a la vez", () => {
    expect(
      envioValido({ destinoCentroId: "c2", destinoTexto: "Albergue", transporte: "Juan", items }),
    ).toBe(false);
  });

  test("inválido: sin transporte", () => {
    expect(
      envioValido({ destinoCentroId: "c2", destinoTexto: "", transporte: "  ", items }),
    ).toBe(false);
  });

  test("inválido: ningún item con cantidad", () => {
    const sinItems = items.map((i) => ({ ...i, cantidad: 0 }));
    expect(
      envioValido({ destinoCentroId: "c2", destinoTexto: "", transporte: "Juan", items: sinItems }),
    ).toBe(false);
  });

  test("inválido: una cantidad supera el stock", () => {
    const excede = [{ insumoId: "i1", nombre: "Agua", cantidadTotal: 3, cantidad: 9 }];
    expect(
      envioValido({ destinoCentroId: "c2", destinoTexto: "", transporte: "Juan", items: excede }),
    ).toBe(false);
  });
});
