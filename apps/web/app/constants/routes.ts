export const ROUTES = {
  home: "/",
  donar: "/donar",
  centros: "/centros",
  crearCentro: "/centros/nuevo",
  misCentros: "/mis-centros",
  misCentroDetalle: (id: string) => `/mis-centros/${id}`,
  misCentroEditar: (id: string) => `/mis-centros/${id}/editar`,
  invitarVoluntarios: (id: string) => `/mis-centros/${id}/invitar`,
  unirse: (token: string) => `/unirse/${token}`,
  inventario: "/inventario",
  scanning: "/scanning",
} as const;
