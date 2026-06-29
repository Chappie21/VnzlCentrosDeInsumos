import { getFingerprint } from "../fingerprint";
import { getToken } from "./auth";
import type { DonationItem } from "./donation";
import type { Categoria } from "../constants/categorias";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-fingerprint": getFingerprint(), // solo rate limit
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers),
    },
  });
}

export type OnboardBody = { nombre?: string; cedula: string; telefono: string };

export type Me = {
  id: string;
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  identidadCompleta: boolean;
};

export function onboard(body: OnboardBody) {
  return apiFetch("/usuarios/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMe() {
  return apiFetch("/usuarios/me");
}

// Insumo sembrado al crear el centro (carga inicial). cantidad >= 0 (B3: permite 0).
export type InsumoInicial = { nombre: string; categoria?: Categoria; cantidad: number };

export type CreateCentroBody = {
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
  geoLat?: number; // geo del dispositivo al registrar (anti-fraude)
  geoLng?: number;
  insumos?: InsumoInicial[];
};

export type EstadoVerificacion = "PENDIENTE" | "VERIFICADO" | "RECHAZADO";

export type CreatedCentro = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  recibiendoAhora: boolean;
};

export function createCentro(body: CreateCentroBody) {
  return apiFetch("/centros", { method: "POST", body: JSON.stringify(body) });
}

// Rol del usuario en un centro: JEFE = dueño, VOLUNTARIO = ayudante.
export type RolCentro = "JEFE" | "VOLUNTARIO";

export type MiInsumo = {
  id: string;
  nombre: string;
  nivel: string;
  categoria: string | null;
  cantidadTotal: number;
};

export type MiCentro = {
  id: string;
  nombre: string;
  ciudad: string;
  estado: string;
  direccion: string;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  voluntarios: number;
  insumos: MiInsumo[];
  rol: RolCentro;
};

// Centros del usuario actual (dueño + voluntario). Fingerprint en header (apiFetch).
export async function getMisCentros(): Promise<MiCentro[]> {
  const res = await apiFetch("/centros/mios");
  if (!res.ok) throw new Error("No se pudieron cargar tus centros");
  return res.json();
}

// Registrar donación escaneada por nombre en un centro (CEN-19).
export function recibirDonacion(centroId: string, items: DonationItem[]) {
  return apiFetch("/historial/recibir", {
    method: "POST",
    body: JSON.stringify({ centroId, items }),
  });
}

// Lista liviana de centros para el dropdown de destino (CEN-17).
export type CentroLite = { id: string; nombre: string; ciudad: string };
export async function getCentrosSelect(): Promise<CentroLite[]> {
  // ponytail: trae la primera página (máx del backend = 50). Si los centros pasan
  // de 50, paginar o agregar un endpoint liviano de solo {id, nombre}.
  const res = await apiFetch("/centros?limit=50");
  if (!res.ok) throw new Error("No se pudieron cargar los centros");
  const data = await res.json();
  return (data.items ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre, ciudad: c.ciudad }));
}

// Despachar un envío desde un centro (CEN-16/17). Origen = `centroId`.
export type EnvioBody = {
  centroId: string;
  centroDestinoId?: string;
  destinoTexto?: string;
  transporte: string;
  items: { insumoId: string; cantidad: number }[];
};
export async function crearEnvio(body: EnvioBody): Promise<{ id: string }> {
  const res = await apiFetch("/envios", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(msg || "No se pudo generar el envío");
  }
  return res.json();
}

// Guía pública de un envío (a la que apunta el QR). CEN-18.
export type GuiaDestino = { nombre: string; ciudad: string } | { texto: string | null };
export type Guia = {
  id: string;
  creadoEn: string;
  transporte: string;
  despachadoPor: string | null;
  origen: { nombre: string; ciudad: string; estado: string };
  destino: GuiaDestino;
  items: { nombre: string; cantidad: number }[];
};
export async function getGuia(id: string): Promise<Guia> {
  const res = await apiFetch(`/envios/${id}`);
  if (!res.ok) throw new Error("Guía no encontrada");
  return res.json();
}

// ---- Invitación de voluntarios (JWT 1h, QR + link) ----

// Crear invitación (solo JEFE). Devuelve el token y su expiración en minutos.
export type Invitacion = { token: string; expiresInMin: number };
export async function crearInvitacion(centroId: string): Promise<Invitacion> {
  const res = await apiFetch("/invitaciones", {
    method: "POST",
    body: JSON.stringify({ centroId }),
  });
  if (!res.ok) throw new Error("No se pudo generar la invitación");
  return res.json();
}

// Aceptar invitación (requiere identidad completa). Devuelve el centro al que se unió.
export type InvitacionAceptada = { centroId: string; nombre: string };
export async function aceptarInvitacion(token: string): Promise<InvitacionAceptada> {
  const res = await apiFetch("/invitaciones/aceptar", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Invitación inválida o expirada");
  return res.json();
}

// ---- Detalle de un centro (solo miembros) ----

export type NivelInsumo = "URGENTE" | "NORMAL" | "SUFICIENTE";

export type InsumoDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  nivel: NivelInsumo;
  categoria: string | null;
  cantidadTotal: number;
  // Umbrales del nivel automático. Si ambos != null el nivel se autocalcula y la UI
  // lo muestra de solo lectura. null = nivel manual.
  umbralUrgente: number | null;
  umbralSuficiente: number | null;
};

export type CentroDetalle = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  verificacion: EstadoVerificacion;
  fotoUrl: string | null;
  voluntarios: number;
  donaciones: number;
  rol: RolCentro;
  insumos: InsumoDetalle[];
};

export async function getCentroDetalle(id: string): Promise<CentroDetalle> {
  const res = await apiFetch(`/centros/${id}`);
  if (!res.ok) throw new Error("No se pudo cargar el centro");
  return res.json();
}

// ---- Detalle PÚBLICO de un centro (directorio, sin identidad) ----

export type NecesidadPublica = {
  nombre: string;
  nivel: NivelInsumo;
  categoria: string | null;
  cantidad: number;
};

export type CentroPublico = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  voluntarios: number;
  necesidades: NecesidadPublica[];
};

export async function getCentroPublico(id: string): Promise<CentroPublico> {
  const res = await apiFetch(`/centros/${id}/publico`);
  if (!res.ok) throw new Error("No se pudo cargar el centro");
  return res.json();
}

// Datos principales (solo JEFE). Devuelve el Response para que el caller maneje !ok.
export type UpdateCentroBody = Partial<CreateCentroBody>;
export function updateCentro(id: string, body: UpdateCentroBody) {
  return apiFetch(`/centros/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// Estado operativo (cualquier voluntario).
export type UpdateOperativoBody = { recibiendoAhora?: boolean; horarioCierre?: string };
export function updateOperativo(id: string, body: UpdateOperativoBody) {
  return apiFetch(`/centros/${id}/operativo`, { method: "PATCH", body: JSON.stringify(body) });
}

// Metadata de un insumo (cualquier voluntario). Nunca cantidadTotal.
export type UpdateInsumoBody = {
  nombre?: string;
  descripcion?: string;
  nivel?: NivelInsumo;
  categoria?: string;
};
export function updateInsumo(id: string, body: UpdateInsumoBody) {
  return apiFetch(`/insumos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// Configurar umbrales por insumo (solo JEFE). null en cualquiera de los dos = limpiar
// (insumo vuelve a nivel manual). El backend recalcula `nivel` con el stock actual.
export type UmbralFila = {
  insumoId: string;
  umbralUrgente: number | null;
  umbralSuficiente: number | null;
};
export function updateUmbrales(centroId: string, insumos: UmbralFila[]) {
  return apiFetch(`/centros/${centroId}/umbrales`, {
    method: "PATCH",
    body: JSON.stringify({ insumos }),
  });
}

// Ajuste manual de stock (solo JEFE). cantidad ≠ 0 (+/-). Devuelve el Response para
// que el caller maneje !ok (400 si dejaría el stock negativo).
export function ajustarStock(centroId: string, insumoId: string, cantidad: number, motivo?: string) {
  return apiFetch("/historial/ajuste", {
    method: "POST",
    body: JSON.stringify({ centroId, insumoId, cantidad, motivo }),
  });
}

// ---- Gestión de voluntarios (solo JEFE) ----

// Un miembro del centro tal como lo ve el JEFE. `id` = Voluntario.id (clave de
// remoción). Nunca el fingerprint. nombre/cedula/telefono son no-null para miembros
// (la identidad completa es requisito para unirse/crear).
export type VoluntarioItem = {
  id: string;
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  rol: RolCentro;
  asignadoEn: string;
};

export async function getVoluntarios(centroId: string): Promise<VoluntarioItem[]> {
  const res = await apiFetch(`/centros/${centroId}/voluntarios`);
  if (!res.ok) throw new Error("No se pudieron cargar los voluntarios");
  return res.json();
}

// Remover un voluntario por su Voluntario.id. El server (JefeGuard) bloquea remover
// al jefe y el borrado cruzado entre centros.
export async function removerVoluntario(centroId: string, voluntarioId: string): Promise<void> {
  const res = await apiFetch(`/centros/${centroId}/voluntarios/${voluntarioId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || "No se pudo remover el voluntario");
  }
}

// ---- Verificación de centros (CEN-21) ----

// Foto del local/cartel (data URL base64). Solo el JEFE. El cliente la comprime antes.
export async function subirFoto(centroId: string, foto: string): Promise<{ fotoUrl: string }> {
  const res = await apiFetch(`/centros/${centroId}/foto`, {
    method: "POST",
    body: JSON.stringify({ foto }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(msg || "No se pudo subir la foto");
  }
  return res.json();
}

// Panel de moderación (solo equipo, token compartido en header x-admin-token).
export type CentroModeracion = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  verificacion: EstadoVerificacion;
  verificadoEn: string | null;
  creadoEn: string;
  fotoUrl: string | null;
  latitud: number | null;
  longitud: number | null;
  geoLat: number | null;
  geoLng: number | null;
  distanciaGeoM: number | null;
  responsable: {
    nombre: string | null;
    cedula: string | null;
    telefono: string | null;
    cedulaVerificada: boolean | null;
    cedulaNombre: string | null;
  } | null;
  reportesCount: number;
  reportado: boolean;
  reportes: { motivo: MotivoReporte; comentario: string | null; creadoEn: string }[];
};

// Login de moderador (opción C): email + password → sesión JWT (8h).
export async function adminLogin(
  email: string,
  password: string,
): Promise<{ token: string; nombre: string }> {
  const res = await apiFetch("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) throw new Error("Credenciales inválidas");
  if (!res.ok) throw new Error("No se pudo iniciar sesión");
  return res.json();
}

export async function getModeracion(
  token: string,
  estado?: EstadoVerificacion,
): Promise<CentroModeracion[]> {
  const qs = estado ? `?estado=${estado}` : "";
  const res = await apiFetch(`/centros/moderacion${qs}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Sesión inválida o expirada");
  if (!res.ok) throw new Error("No se pudo cargar la moderación");
  return res.json();
}

export async function verificarCentro(
  token: string,
  centroId: string,
  estado: EstadoVerificacion,
): Promise<void> {
  const res = await apiFetch(`/centros/${centroId}/verificacion`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("No se pudo actualizar la verificación");
}

// ---- Reporte comunitario (CEN-22) ----

export type MotivoReporte = "NO_EXISTE" | "INFO_INCORRECTA" | "ENGANOSO";

// Reportar un centro inválido. Anónimo (fingerprint en el header, vía apiFetch).
export async function reportarCentro(
  centroId: string,
  motivo: MotivoReporte,
  comentario?: string,
): Promise<void> {
  const res = await apiFetch(`/centros/${centroId}/reportes`, {
    method: "POST",
    body: JSON.stringify({ motivo, ...(comentario ? { comentario } : {}) }),
  });
  if (!res.ok) throw new Error("No se pudo enviar el reporte");
}
