import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, sortByProximity } from "./geo";

test("haversine: Maracaibo->Caracas ~520km", () => {
  const d = haversineKm(10.654, -71.64, 10.48, -66.9);
  assert.ok(d > 500 && d < 540, `got ${d}`);
});

test("sort: near center beats far center", () => {
  const me = { lat: 10.5, lng: -66.9 };
  const out = sortByProximity(
    [
      { id: "far", latitud: 10.654, longitud: -71.64 },
      { id: "near", latitud: 10.48, longitud: -66.9 },
    ],
    me.lat,
    me.lng,
  );
  assert.equal(out[0].id, "near");
});

test("sort: null coords sink to the bottom", () => {
  const out = sortByProximity(
    [
      { id: "nocoords", latitud: null, longitud: null },
      { id: "has", latitud: 10.48, longitud: -66.9 },
    ],
    10.5,
    -66.9,
  );
  assert.equal(out[0].id, "has");
});
