import { describe, it, expect } from "vitest";
import { distanciaMetros } from "./geo";

describe("distanciaMetros (haversine)", () => {
  it("0 para el mismo punto", () => {
    expect(distanciaMetros(10.5, -66.9, 10.5, -66.9)).toBe(0);
  });

  it("~1113 m por 0.01° de latitud", () => {
    const d = distanciaMetros(10.0, -66.0, 10.01, -66.0);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });

  it("Caracas centro ↔ Baruta ~8-9 km", () => {
    const d = distanciaMetros(10.5061, -66.9146, 10.4339, -66.8758);
    expect(d).toBeGreaterThan(7000);
    expect(d).toBeLessThan(10000);
  });
});
