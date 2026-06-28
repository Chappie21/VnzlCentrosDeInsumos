export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 50,
  // ponytail: tope de candidatos cargados a memoria para el orden por proximidad
  // (Haversine no es paginable en DB). Subir o migrar a PostGIS si crece la escala.
  candidateCap: 500,
  maxBadges: 3, // necesidades visibles por card
} as const;
