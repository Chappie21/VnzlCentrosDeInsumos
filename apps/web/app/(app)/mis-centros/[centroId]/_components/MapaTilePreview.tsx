"use client";

import { buildTileGrid, osmTileUrl } from "../_lib/anuncioTiles";

// Preview de mapa hecho con tiles OSM (sin Leaflet) para que html-to-image lo
// pueda capturar como imagen. Caja de tamaño fijo con un pin centrado.
export default function MapaTilePreview({
  lat,
  lng,
  boxW = 600,
  boxH = 360,
  className,
}: {
  lat: number;
  lng: number;
  boxW?: number;
  boxH?: number;
  className?: string;
}) {
  const grid = buildTileGrid(lat, lng, 15, boxW, boxH);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: boxW,
        height: boxH,
        overflow: "hidden",
        background: "#e5e3df",
      }}
    >
      {grid.tiles.map((t) => (
        <img
          key={`${t.z}-${t.x}-${t.y}`}
          src={osmTileUrl(t.x, t.y, t.z)}
          // crossOrigin es imprescindible para que html-to-image pueda leer los
          // píxeles de los tiles (si no, el canvas queda "tainted").
          crossOrigin="anonymous"
          width={256}
          height={256}
          alt=""
          style={{ position: "absolute", left: t.left, top: t.top }}
        />
      ))}
      {/* Pin centrado: SVG inline (no web-font) para que html-to-image lo capture
          sin depender de Material Symbols. translate(-50%,-100%) apunta la punta
          al lugar exacto. */}
      <svg
        width={48}
        height={48}
        viewBox="0 0 24 24"
        fill="#b83230"
        aria-hidden
        style={{
          position: "absolute",
          left: grid.pinLeft,
          top: grid.pinTop,
          transform: "translate(-50%, -100%)",
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,.4))",
        }}
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
      </svg>
    </div>
  );
}
