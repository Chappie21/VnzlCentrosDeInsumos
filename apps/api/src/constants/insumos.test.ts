import { describe, it, expect } from "vitest";
import { NivelInsumo } from "@vnzl/database";
import { calcularNivel } from "./insumos";

describe("calcularNivel", () => {
  it("sin umbrales (alguno null) devuelve null = nivel manual", () => {
    expect(calcularNivel(5, null, null)).toBeNull();
    expect(calcularNivel(5, 3, null)).toBeNull();
    expect(calcularNivel(5, null, 10)).toBeNull();
  });

  it("<= urgente -> URGENTE (límite inclusivo)", () => {
    expect(calcularNivel(0, 3, 10)).toBe(NivelInsumo.URGENTE);
    expect(calcularNivel(3, 3, 10)).toBe(NivelInsumo.URGENTE);
  });

  it("entre umbrales -> NORMAL", () => {
    expect(calcularNivel(4, 3, 10)).toBe(NivelInsumo.NORMAL);
    expect(calcularNivel(9, 3, 10)).toBe(NivelInsumo.NORMAL);
  });

  it(">= suficiente -> SUFICIENTE (límite inclusivo)", () => {
    expect(calcularNivel(10, 3, 10)).toBe(NivelInsumo.SUFICIENTE);
    expect(calcularNivel(50, 3, 10)).toBe(NivelInsumo.SUFICIENTE);
  });
});
