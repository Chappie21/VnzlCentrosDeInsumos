// Math de "slippy map" de OpenStreetMap para armar un preview de mapa con
// tiles (256px) centrado en un pin. Funciones puras: sin React, sin DOM.

const TILE_SIZE = 256;

/** URL de un tile OSM (usa el subdominio "a"). */
export function osmTileUrl(x: number, y: number, z: number): string {
  return `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export type TileCell = {
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
};

export type TileGrid = {
  /** Tiles a renderizar, con posición absoluta en px dentro del box. */
  tiles: TileCell[];
  /** px del pin dentro del box (queda ~centrado: boxW/2). */
  pinLeft: number;
  /** px del pin dentro del box (~boxH/2). */
  pinTop: number;
};

/** Píxel global (x,y) del punto lat/lng en el zoom z. */
function latLngToGlobalPx(
  lat: number,
  lng: number,
  z: number,
): { globalX: number; globalY: number } {
  const worldPx = TILE_SIZE * Math.pow(2, z);
  const globalX = ((lng + 180) / 360) * worldPx;
  const latRad = (lat * Math.PI) / 180;
  const globalY = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * worldPx;
  return { globalX, globalY };
}

/**
 * Arma la grilla de tiles que cubre un box de boxW x boxH px, centrado en el
 * punto (lat,lng). El pin queda en el centro del box.
 */
export function buildTileGrid(
  lat: number,
  lng: number,
  z: number,
  boxW: number,
  boxH: number,
): TileGrid {
  const nTiles = Math.pow(2, z); // cantidad de tiles por lado en este zoom
  const { globalX, globalY } = latLngToGlobalPx(lat, lng, z);

  // El pin va centrado en el box.
  const pinLeft = boxW / 2;
  const pinTop = boxH / 2;

  // Origen del box en coordenadas de píxel global (esquina sup-izq).
  const originX = globalX - boxW / 2;
  const originY = globalY - boxH / 2;

  // Rango de tiles que tocan el box, con 1 tile extra de margen por lado.
  const firstTileX = Math.floor(originX / TILE_SIZE) - 1;
  const lastTileX = Math.floor((originX + boxW) / TILE_SIZE) + 1;
  const firstTileY = Math.floor(originY / TILE_SIZE) - 1;
  const lastTileY = Math.floor((originY + boxH) / TILE_SIZE) + 1;

  const tiles: TileCell[] = [];
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    // y se clampea al rango válido (no envuelve).
    if (ty < 0 || ty > nTiles - 1) continue;
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      // x envuelve (módulo) para el meridiano ±180.
      const wrappedX = ((tx % nTiles) + nTiles) % nTiles;
      tiles.push({
        x: wrappedX,
        y: ty,
        z,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }

  return { tiles, pinLeft, pinTop };
}
