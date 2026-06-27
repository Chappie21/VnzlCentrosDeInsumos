export const CACHE = {
  // El listado se cachea por combinación de filtros+página: key = prefix:v{version}:{hash}.
  // Un contador de versión se incrementa en cada write para invalidar todo de una,
  // sin SCAN/KEYS sobre el patrón.
  centrosListPrefix: "centros:list",
  centrosVersionKey: "centros:list:version",
} as const;

export const TTL = {
  centrosList: 30, // segundos
} as const;
