import { describe, it, expect } from "vitest";
import { haversineKm, sortByProximity, boundingBox } from "./geo";

describe("geo", () => {
  it("haversine: Maracaibo->Caracas ~520km", () => {
    const d = haversineKm(10.654, -71.64, 10.48, -66.9);
    expect(d > 500 && d < 540).toBe(true);
  });

  it("sort: near center beats far center", () => {
    const me = { lat: 10.5, lng: -66.9 };
    const out = sortByProximity(
      [
        { id: "far", latitud: 10.654, longitud: -71.64 },
        { id: "near", latitud: 10.48, longitud: -66.9 },
      ],
      me.lat,
      me.lng,
    );
    expect(out[0].id).toBe("near");
  });

  it("sort: null coords sink to the bottom", () => {
    const out = sortByProximity(
      [
        { id: "nocoords", latitud: null, longitud: null },
        { id: "has", latitud: 10.48, longitud: -66.9 },
      ],
      10.5,
      -66.9,
    );
    expect(out[0].id).toBe("has");
  });

  it("boundingBox: contiene el centro y crece con el radio", () => {
    const lat = 10.5;
    const lng = -66.9;
    const small = boundingBox(lat, lng, 10);
    const big = boundingBox(lat, lng, 100);
    // el centro cae dentro de la caja
    expect(lat).toBeGreaterThan(small.minLat);
    expect(lat).toBeLessThan(small.maxLat);
    // más radio -> caja más ancha
    expect(big.maxLat - big.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });
});
