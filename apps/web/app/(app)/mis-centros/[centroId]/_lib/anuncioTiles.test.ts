import { describe, it, expect } from "vitest";
import { osmTileUrl, buildTileGrid } from "./anuncioTiles";

describe("osmTileUrl", () => {
  it("arma la URL del tile con el subdominio 'a'", () => {
    expect(osmTileUrl(1, 2, 3)).toBe(
      "https://a.tile.openstreetmap.org/3/1/2.png",
    );
  });
});

describe("buildTileGrid", () => {
  // Caracas. Valores de tile verificados calculando (el enunciado sugería
  // x=11040, y=15008 pero el cálculo real en z=15 da x=10294, y=15424).
  const lat = 10.4806;
  const lng = -66.9036;
  const z = 15;
  const boxW = 600;
  const boxH = 360;

  it("incluye el tile que contiene el punto", () => {
    const grid = buildTileGrid(lat, lng, z, boxW, boxH);
    const found = grid.tiles.find(
      (t) => t.x === 10294 && t.y === 15424 && t.z === z,
    );
    expect(found).toBeDefined();
  });

  it("centra el pin en el box", () => {
    const grid = buildTileGrid(lat, lng, z, boxW, boxH);
    expect(grid.pinLeft).toBe(boxW / 2);
    expect(grid.pinTop).toBe(boxH / 2);
  });

  it("posiciona el tile del punto de forma que el sub-píxel quede centrado", () => {
    const grid = buildTileGrid(lat, lng, z, boxW, boxH);
    const tile = grid.tiles.find((t) => t.x === 10294 && t.y === 15424)!;
    expect(tile).toBeDefined();
    // Sub-píxel esperado del punto dentro de su tile (verificado calculando):
    const subX = 73.1272533335723;
    const subY = 170.9022268485278;
    expect(tile.left + subX).toBeCloseTo(boxW / 2, 0); // tolerancia ~1px
    expect(tile.top + subY).toBeCloseTo(boxH / 2, 0);
  });

  it("cubre el box sin huecos (tiles contiguos que abarcan el box)", () => {
    const grid = buildTileGrid(lat, lng, z, boxW, boxH);
    const minLeft = Math.min(...grid.tiles.map((t) => t.left));
    const maxRight = Math.max(...grid.tiles.map((t) => t.left + 256));
    const minTop = Math.min(...grid.tiles.map((t) => t.top));
    const maxBottom = Math.max(...grid.tiles.map((t) => t.top + 256));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(boxW);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(boxH);
  });
});
