// Haversine distance in km. ponytail: in-memory sort over a bounded query.
// Upgrade path: PostGIS + ST_DWithin if centers ever number in the thousands.
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sortByProximity<T extends { latitud: number | null; longitud: number | null }>(
  items: T[],
  lat: number,
  lng: number,
): (T & { distanciaKm: number | null })[] {
  return items
    .map((c) => ({
      ...c,
      distanciaKm:
        c.latitud != null && c.longitud != null
          ? haversineKm(lat, lng, c.latitud, c.longitud)
          : null,
    }))
    .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
}
