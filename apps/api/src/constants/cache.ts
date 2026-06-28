export const CACHE = {
  // El listado se cachea por combinación de filtros+página: key = prefix:v{version}:{hash}.
  // Un contador de versión se incrementa en cada write para invalidar todo de una,
  // sin SCAN/KEYS sobre el patrón.
  centrosListPrefix: "centros:list",
  centrosVersionKey: "centros:list:version",
  // Mapa público y detalle público: mismo versionado (bumpCentros invalida todo).
  centrosMapaPrefix: "centros:mapa",
  centrosPublicoPrefix: "centros:publico",
} as const;

export const TTL = {
  centrosList: 30, // segundos
  // Versionados → TTL generoso (la frescura la da el bump de versión en cada write).
  centrosMapa: 300, // las coords casi no cambian
  centrosPublico: 120, // detalle público
} as const;
