import L from "leaflet";

// Pin compartido para mapas de un solo punto (crear centro, moderación).
// divIcon con Material Symbols (fuente global) en vez de los PNG default de
// Leaflet: esos assets no resuelven bajo Turbopack y el marker queda invisible.
// iconAnchor = punta abajo. El mapa público usa puntos de color propios.
export const pinIcon = L.divIcon({
  className: "",
  html: `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;font-size:40px;line-height:1;display:block;color:#b3261e;text-shadow:0 1px 2px rgba(0,0,0,.4)">location_on</span>`,
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -36],
});
