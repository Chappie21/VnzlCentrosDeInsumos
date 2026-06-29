// Textos de la invitación de voluntarios (vista invitar + página de unión).
export const INVITAR = {
  titulo: "Invitar Ayudantes",
  subtitulo: "Comparte este QR o enlace para que se unan como voluntarios.",
  escanear: "Escanear para unirse",
  enlace: "Compartir enlace de invitación",
  copiar: "Copiar",
  copiado: "¡Copiado!",
  descargar: "Descargar QR",
  regenerar: "Regenerar",
  expira: "Este enlace expira en 1 hora",
  generando: "Generando invitación…",
  error: "No se pudo generar la invitación.",
} as const;

export const UNIRSE = {
  cargando: "Uniéndote al centro…",
  exito: (nombre: string) => `Te uniste a ${nombre}`,
  verCentro: "Ver centro",
  errorTitulo: "Invitación inválida o expirada",
  errorSubtitulo: "Pedí un nuevo enlace al responsable del centro.",
  irDirectorio: "Ver directorio de centros",
} as const;
