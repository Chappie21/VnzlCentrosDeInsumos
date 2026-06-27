import { getFingerprint } from "../fingerprint";
import type { DonationItem } from "./donation";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-fingerprint": getFingerprint(),
      "content-type": "application/json",
      ...(init?.headers),
    },
  });
}

export type OnboardBody = { nombre: string; cedula: string; telefono: string };

export type Me = {
  fingerprint: string;
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

export type CreateCentroBody = {
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
};

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
