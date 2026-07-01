import { describe, it, expect } from "vitest";
import { seleccionarNecesidades } from "./anuncioInsumos";
import type { InsumoDetalle } from "../../../../lib/api";

function insumo(
  nombre: string,
  nivel: InsumoDetalle["nivel"],
): InsumoDetalle {
  return {
    id: nombre,
    nombre,
    descripcion: null,
    nivel,
    categoria: null,
    cantidadTotal: 0,
    umbralUrgente: null,
    umbralSuficiente: null,
  };
}

describe("seleccionarNecesidades", () => {
  it("(a) con urgentes en la mezcla devuelve solo urgentes", () => {
    const res = seleccionarNecesidades([
      insumo("Agua", "URGENTE"),
      insumo("Arroz", "NORMAL"),
      insumo("Sal", "SUFICIENTE"),
      insumo("Gasa", "URGENTE"),
    ]);
    expect(res.nivelUsado).toBe("URGENTE");
    expect(res.vacio).toBe(false);
    expect(res.items.map((i) => i.nombre)).toEqual(["Agua", "Gasa"]);
    expect(res.extra).toBe(0);
  });

  it("(b) sin urgentes pero con normales usa NORMAL", () => {
    const res = seleccionarNecesidades([
      insumo("Arroz", "NORMAL"),
      insumo("Sal", "SUFICIENTE"),
      insumo("Harina", "NORMAL"),
    ]);
    expect(res.nivelUsado).toBe("NORMAL");
    expect(res.vacio).toBe(false);
    expect(res.items.map((i) => i.nombre)).toEqual(["Arroz", "Harina"]);
    expect(res.extra).toBe(0);
  });

  it("(c) todo SUFICIENTE queda vacío", () => {
    const res = seleccionarNecesidades([
      insumo("Sal", "SUFICIENTE"),
      insumo("Azúcar", "SUFICIENTE"),
    ]);
    expect(res.vacio).toBe(true);
    expect(res.nivelUsado).toBeNull();
    expect(res.items).toEqual([]);
    expect(res.extra).toBe(0);
  });

  it("(d) más de `max` urgentes capea y reporta el resto en extra", () => {
    const urgentes = Array.from({ length: 11 }, (_, k) =>
      insumo(`U${k}`, "URGENTE"),
    );
    const res = seleccionarNecesidades(urgentes, 8);
    expect(res.nivelUsado).toBe("URGENTE");
    expect(res.items.length).toBe(8);
    expect(res.extra).toBe(3);
    expect(res.vacio).toBe(false);
  });

  it("lista vacía queda vacío", () => {
    const res = seleccionarNecesidades([]);
    expect(res.vacio).toBe(true);
    expect(res.nivelUsado).toBeNull();
    expect(res.items).toEqual([]);
    expect(res.extra).toBe(0);
  });
});
