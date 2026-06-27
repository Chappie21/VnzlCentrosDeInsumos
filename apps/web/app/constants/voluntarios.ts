// Textos de la gestión de voluntarios (vista solo-JEFE: listar + remover).
export const VOLUNTARIOS = {
  titulo: "Voluntarios",
  subtitulo: (n: number) => `${n} ${n === 1 ? "voluntario" : "voluntarios"}`,
  invitar: "Invitar voluntarios",
  buscar: "Buscar por nombre o contacto…",
  cargando: "Cargando voluntarios…",
  vacioTitulo: "Sin voluntarios todavía",
  vacioSubtitulo: "Invitá a tu equipo para que se una al centro.",
  sinResultados: "Ningún voluntario coincide con la búsqueda.",
  errorTitulo: "No se pudieron cargar los voluntarios",
  errorSubtitulo: "Revisá tu conexión e intentá de nuevo.",
  // Gate de rol (la API igual lo refuerza con JefeGuard).
  soloJefeTitulo: "Solo el jefe gestiona voluntarios",
  soloJefeSubtitulo: "Esta sección está disponible para el responsable del centro.",
  // Remoción + confirmación.
  remover: "Remover",
  removerAria: (nombre: string) => `Remover a ${nombre}`,
  confirmarTitulo: (nombre: string) => `¿Remover a ${nombre}?`,
  confirmarTexto: "Dejará de ser voluntario de este centro. Podés volver a invitarlo cuando quieras.",
  confirmar: "Remover",
  cancelar: "Cancelar",
  cerrar: "Cerrar",
  removiendo: "Removiendo…",
  errorRemover: "No se pudo remover el voluntario.",
} as const;
