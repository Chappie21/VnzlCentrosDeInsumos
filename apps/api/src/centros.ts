import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  registerDecorator,
  type ValidationArguments,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma, Prisma, NivelInsumo, CategoriaInsumo, RolVoluntario, EstadoVerificacion, TipoMovimiento, MotivoReporte } from "@vnzl/database";
import { ESTADOS, municipiosDe, distanciaMetros, parseCedula } from "@vnzl/venezuela";
import { RedisService } from "./redis.service";
import { EmailService } from "./email.service";
import { CedulaService } from "./cedula";
import { RateLimitGuard, IdentidadGuard, VoluntarioGuard, JefeGuard, AdminGuard, userIdOf } from "./guards";
import { calcularNivel } from "./constants/insumos";
import { boundingBox, sortByProximity } from "./geo";
import { PAGINATION, CACHE, TTL, NIVEL_ORDER } from "./constants";

// query strings -> boolean, preservando undefined cuando el param no viene
const toOptionalBool = () =>
  Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === "true" || value === "1",
  );

// Valida que la ciudad pertenezca al estado enviado (whitelist @vnzl/venezuela).
// Cross-field: lee el sibling `estado` del objeto en validación.
function IsCiudadDeEstado() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isCiudadDeEstado",
      target: object.constructor,
      propertyName,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const estado = (args.object as { estado?: string }).estado ?? "";
          return typeof value === "string" && municipiosDe(estado).includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          const estado = (args.object as { estado?: string }).estado ?? "";
          return `ciudad no pertenece al estado "${estado}"`;
        },
      },
    });
  };
}

// Inventario inicial (carga de un acopio que se digitaliza). cantidad admite 0
// (decisión B3: registrar un insumo sin stock todavía). Solo en la creación.
export class InsumoInicialDto {
  @IsString() @MaxLength(80) nombre: string;
  @IsOptional() @IsEnum(CategoriaInsumo) categoria?: CategoriaInsumo;
  @IsInt() @Min(0) cantidad: number;
}

export class CreateCentroDto {
  @IsString() nombre: string;
  @IsString() @IsIn([...ESTADOS]) estado: string;
  @IsString() @IsCiudadDeEstado() ciudad: string;
  @IsString() direccion: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitud?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitud?: number;
  // Geo del dispositivo al registrar (anti-fraude: se compara con la dirección).
  @IsOptional() @Type(() => Number) @IsLatitude() geoLat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() geoLng?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InsumoInicialDto)
  insumos?: InsumoInicialDto[];
}

// Moderación (solo equipo): marcar un centro verificado o rechazado.
export class VerificarDto {
  @IsEnum(EstadoVerificacion) estado: EstadoVerificacion;
}

// Foto del local/cartel como data URL (base64). ponytail: JSON en vez de multipart
// para no sumar multer; el cliente la comprime antes de enviar.
export class FotoDto {
  @IsString() foto: string; // "data:image/jpeg;base64,...."
}

// Reporte comunitario de un centro inválido (CEN-22). Anónimo (fingerprint).
export class ReporteDto {
  @IsEnum(MotivoReporte) motivo: MotivoReporte;
  @IsOptional() @IsString() @MaxLength(280) comentario?: string;
}

// A partir de cuántos reportes (dispositivos distintos) el centro se marca
// "reportado" y sube al tope de la cola de moderación. ponytail: umbral fijo.
const REPORTE_THRESHOLD = 3;

// Edición de datos principales (solo JEFE). Todo opcional: se actualiza solo lo
// enviado. Regla: `ciudad` necesita `estado` para validar contra la whitelist, así
// que si viene `ciudad` exigimos también `estado` (ValidateIf fuerza su presencia).
export class UpdateCentroDto {
  @IsOptional() @IsString() nombre?: string;
  @ValidateIf((o) => o.estado !== undefined || o.ciudad !== undefined)
  @IsString() @IsIn([...ESTADOS]) estado?: string;
  @IsOptional() @IsString() @IsCiudadDeEstado() ciudad?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitud?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitud?: number;
}

// Estado operativo (cualquier voluntario). `horarioCierre` admite "" / null para
// limpiarlo (solo display, nunca se filtra por él).
export class UpdateOperativoDto {
  @IsOptional() @IsBoolean() recibiendoAhora?: boolean;
  @IsOptional() @IsString() horarioCierre?: string | null;
}

// Umbrales por insumo (solo JEFE). `null` en cualquiera de los dos = limpiar
// (insumo vuelve a nivel manual). @ValidateIf deja pasar el null sin disparar @IsInt.
class UmbralFilaDto {
  @IsString() insumoId: string;
  @ValidateIf((_, v) => v !== null) @IsOptional() @IsInt() @Min(0) umbralUrgente?: number | null;
  @ValidateIf((_, v) => v !== null) @IsOptional() @IsInt() @Min(0) umbralSuficiente?: number | null;
}

export class UpdateUmbralesDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UmbralFilaDto)
  insumos: UmbralFilaDto[];
}

class ListCentrosQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGINATION.maxLimit)
  limit?: number;

  @IsOptional() @IsString() @MaxLength(80)
  q?: string; // matchea nombre OR ciudad, case-insensitive

  @IsOptional() @Type(() => Number) @IsLatitude()
  lat?: number;

  @IsOptional() @Type(() => Number) @IsLongitude()
  lng?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  radiusKm?: number; // bound de "Cerca de mí"; ignorado si falta lat/lng

  @IsOptional() @toOptionalBool() @IsBoolean()
  soloAbiertos?: boolean; // recibiendoAhora = true

  @IsOptional() @toOptionalBool() @IsBoolean()
  urgenciaAlta?: boolean; // >=1 insumo nivel URGENTE

  @IsOptional() @toOptionalBool() @IsBoolean()
  verificado?: boolean; // solo centros verificados por el equipo
}

// Proyección de card: solo lo que la UI necesita. Nunca fingerprint ni voluntarios.
type Necesidad = { nombre: string; nivel: NivelInsumo; categoria: CategoriaInsumo | null };
export type CentroCard = {
  id: string;
  nombre: string;
  ciudad: string;
  estado: string;
  direccion: string;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  verificado: boolean;
  distanciaKm: number | null;
  prioridadAlta: boolean;
  necesidades: Necesidad[];
};

type CentrosPage = {
  items: CentroCard[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

// Punto para el mapa público: lo mínimo para pintar un marker. Sin PII.
export type MapaPunto = {
  id: string;
  nombre: string;
  ciudad: string;
  latitud: number;
  longitud: number;
  recibiendoAhora: boolean;
};

// allowlist de campos (Prisma `select`): garantiza que no se filtre PII
const cardSelect = {
  id: true,
  nombre: true,
  ciudad: true,
  estado: true,
  direccion: true,
  recibiendoAhora: true,
  horarioCierre: true,
  verificacion: true,
  insumos: { select: { nombre: true, nivel: true, categoria: true } },
} satisfies Prisma.CentroSelect;

type CentroRow = Prisma.CentroGetPayload<{ select: typeof cardSelect }> & {
  latitud?: number | null;
  longitud?: number | null;
};

function toCard(c: CentroRow, distanciaKm: number | null): CentroCard {
  const ordenadas = [...c.insumos].sort(
    (a, b) => NIVEL_ORDER[a.nivel] - NIVEL_ORDER[b.nivel],
  );
  return {
    id: c.id,
    nombre: c.nombre,
    ciudad: c.ciudad,
    estado: c.estado,
    direccion: c.direccion,
    recibiendoAhora: c.recibiendoAhora,
    horarioCierre: c.horarioCierre,
    verificado: c.verificacion === EstadoVerificacion.VERIFICADO,
    distanciaKm,
    prioridadAlta: ordenadas.some((i) => i.nivel === NivelInsumo.URGENTE),
    necesidades: ordenadas.slice(0, PAGINATION.maxBadges).map((i) => ({
      nombre: i.nombre,
      nivel: i.nivel,
      categoria: i.categoria,
    })),
  };
}

// Proyección para el dashboard "Mi Centro": incluye id + cantidadTotal de cada
// insumo (necesarios para registrar movimientos) y el conteo de voluntarios.
// Sin coords ni PII.
// Función del fingerprint: el select filtra la relación `voluntarios` al usuario
// actual (take 1) para exponer su `rol`, mientras `_count.voluntarios` mantiene el
// total. Son keys distintas: `voluntarios` (select) vs `_count.voluntarios`.
const miCentroSelect = (userId: string) =>
  ({
    id: true,
    nombre: true,
    ciudad: true,
    estado: true,
    direccion: true,
    recibiendoAhora: true,
    horarioCierre: true,
    insumos: {
      select: { id: true, nombre: true, nivel: true, categoria: true, cantidadTotal: true },
    },
    _count: { select: { voluntarios: true } },
    voluntarios: { where: { usuarioId: userId }, select: { rol: true }, take: 1 },
  }) satisfies Prisma.CentroSelect;

type MiCentroRow = Prisma.CentroGetPayload<{ select: ReturnType<typeof miCentroSelect> }>;

export type MiInsumo = {
  id: string;
  nombre: string;
  nivel: NivelInsumo;
  categoria: CategoriaInsumo | null;
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
  rol: RolVoluntario;
  insumos: MiInsumo[];
};

function toMiCentro(c: MiCentroRow): MiCentro {
  return {
    id: c.id,
    nombre: c.nombre,
    ciudad: c.ciudad,
    estado: c.estado,
    direccion: c.direccion,
    recibiendoAhora: c.recibiendoAhora,
    horarioCierre: c.horarioCierre,
    voluntarios: c._count.voluntarios,
    rol: c.voluntarios[0]?.rol ?? RolVoluntario.VOLUNTARIO,
    insumos: c.insumos,
  };
}

// Proyección del dashboard de detalle (solo miembros). A diferencia de la card
// pública incluye coords + descripcion de insumos; igual que miCentroSelect filtra
// `voluntarios` al usuario actual para exponer su `rol`. Nunca PII de terceros.
const detalleSelect = (userId: string) =>
  ({
    id: true,
    nombre: true,
    estado: true,
    ciudad: true,
    direccion: true,
    latitud: true,
    longitud: true,
    recibiendoAhora: true,
    horarioCierre: true,
    verificacion: true,
    fotoUrl: true,
    creadoEn: true,
    insumos: {
      select: { id: true, nombre: true, descripcion: true, nivel: true, categoria: true, cantidadTotal: true, umbralUrgente: true, umbralSuficiente: true },
    },
    _count: { select: { voluntarios: true } },
    voluntarios: { where: { usuarioId: userId }, select: { rol: true }, take: 1 },
  }) satisfies Prisma.CentroSelect;

type DetalleRow = Prisma.CentroGetPayload<{ select: ReturnType<typeof detalleSelect> }>;

export type InsumoDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  nivel: NivelInsumo;
  categoria: CategoriaInsumo | null;
  cantidadTotal: number;
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
  creadoEn: Date;
  voluntarios: number;
  donaciones: number;
  rol: RolVoluntario;
  insumos: InsumoDetalle[];
};

function toCentroDetalle(c: DetalleRow, donaciones: number): CentroDetalle {
  return {
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    ciudad: c.ciudad,
    direccion: c.direccion,
    latitud: c.latitud,
    longitud: c.longitud,
    recibiendoAhora: c.recibiendoAhora,
    horarioCierre: c.horarioCierre,
    verificacion: c.verificacion,
    fotoUrl: c.fotoUrl,
    creadoEn: c.creadoEn,
    voluntarios: c._count.voluntarios,
    donaciones,
    rol: c.voluntarios[0]?.rol ?? RolVoluntario.VOLUNTARIO,
    insumos: c.insumos,
  };
}

// Detalle PÚBLICO de un centro (sin guard): allowlist segura, sin PII ni datos
// operativos. Insumos sin cantidadTotal (solo nombre/nivel/categoria = necesidades).
const publicoSelect = {
  id: true,
  nombre: true,
  estado: true,
  ciudad: true,
  direccion: true,
  latitud: true,
  longitud: true,
  recibiendoAhora: true,
  horarioCierre: true,
  insumos: { select: { nombre: true, nivel: true, categoria: true, cantidadTotal: true } },
  _count: { select: { voluntarios: true } },
} satisfies Prisma.CentroSelect;

type PublicoRow = Prisma.CentroGetPayload<{ select: typeof publicoSelect }>;

type NecesidadPublica = Necesidad & { cantidad: number };

export type CentroDetallePublico = {
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

function toDetallePublico(c: PublicoRow): CentroDetallePublico {
  const necesidades = [...c.insumos]
    .sort((a, b) => NIVEL_ORDER[a.nivel] - NIVEL_ORDER[b.nivel])
    .map((i) => ({ nombre: i.nombre, nivel: i.nivel, categoria: i.categoria, cantidad: i.cantidadTotal }));
  return {
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    ciudad: c.ciudad,
    direccion: c.direccion,
    latitud: c.latitud,
    longitud: c.longitud,
    recibiendoAhora: c.recibiendoAhora,
    horarioCierre: c.horarioCierre,
    voluntarios: c._count.voluntarios,
    necesidades,
  };
}

// Listado de miembros para la pantalla de gestión (solo JEFE). Allowlist explícita:
// expone el id de la fila Voluntario (clave de remoción) + PII mínima de contacto del
// usuario. NUNCA `usuarioId` (= fingerprint, regla AGENTS.md).
const voluntarioSelect = {
  id: true,
  rol: true,
  asignadoEn: true,
  usuario: { select: { nombre: true, cedula: true, telefono: true } },
} satisfies Prisma.VoluntarioSelect;

type VoluntarioRow = Prisma.VoluntarioGetPayload<{ select: typeof voluntarioSelect }>;

export type VoluntarioItem = {
  id: string;
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  rol: RolVoluntario;
  asignadoEn: Date;
};

function toVoluntarioItem(v: VoluntarioRow): VoluntarioItem {
  return {
    id: v.id,
    nombre: v.usuario.nombre,
    cedula: v.usuario.cedula,
    telefono: v.usuario.telefono,
    rol: v.rol,
    asignadoEn: v.asignadoEn,
  };
}

// Proyección para el panel de moderación (solo equipo, AdminGuard). Incluye
// evidencia (foto, geo) + PII del responsable (JEFE) para poder juzgar legitimidad.
const moderacionSelect = {
  id: true,
  nombre: true,
  estado: true,
  ciudad: true,
  direccion: true,
  verificacion: true,
  verificadoEn: true,
  creadoEn: true,
  fotoUrl: true,
  latitud: true,
  longitud: true,
  geoLat: true,
  geoLng: true,
  voluntarios: {
    where: { rol: RolVoluntario.JEFE },
    select: {
      usuario: {
        select: { nombre: true, cedula: true, telefono: true, cedulaVerificada: true, cedulaNombre: true },
      },
    },
    take: 1,
  },
  _count: { select: { reportes: true } },
  reportes: {
    select: { motivo: true, comentario: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
    take: 20,
  },
} satisfies Prisma.CentroSelect;

type ModeracionRow = Prisma.CentroGetPayload<{ select: typeof moderacionSelect }>;

export type ReporteItem = { motivo: MotivoReporte; comentario: string | null; creadoEn: Date };

export type CentroModeracion = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  verificacion: EstadoVerificacion;
  verificadoEn: Date | null;
  creadoEn: Date;
  fotoUrl: string | null;
  latitud: number | null;
  longitud: number | null;
  geoLat: number | null;
  geoLng: number | null;
  distanciaGeoM: number | null; // entre dirección (mapa) y geo de registro
  responsable: {
    nombre: string | null;
    cedula: string | null;
    telefono: string | null;
    cedulaVerificada: boolean | null;
    cedulaNombre: string | null;
  } | null;
  reportesCount: number;
  reportado: boolean; // >= REPORTE_THRESHOLD
  reportes: ReporteItem[];
};

function toModeracion(c: ModeracionRow): CentroModeracion {
  const tieneAmbas =
    c.latitud != null && c.longitud != null && c.geoLat != null && c.geoLng != null;
  const reportesCount = c._count.reportes;
  return {
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    ciudad: c.ciudad,
    direccion: c.direccion,
    verificacion: c.verificacion,
    verificadoEn: c.verificadoEn,
    creadoEn: c.creadoEn,
    fotoUrl: c.fotoUrl,
    latitud: c.latitud,
    longitud: c.longitud,
    geoLat: c.geoLat,
    geoLng: c.geoLng,
    distanciaGeoM: tieneAmbas
      ? distanciaMetros(c.latitud!, c.longitud!, c.geoLat!, c.geoLng!)
      : null,
    responsable: c.voluntarios[0]?.usuario ?? null,
    reportesCount,
    reportado: reportesCount >= REPORTE_THRESHOLD,
    reportes: c.reportes,
  };
}

@Injectable()
export class CentrosService {
  constructor(
    private readonly redis: RedisService,
    private readonly cedula: CedulaService,
    private readonly email: EmailService,
  ) {}

  // Valida la cédula del creador UNA sola vez y la cachea en Usuario (CEN-23).
  // Best-effort y fire-and-forget: no bloquea ni demora la creación del centro.
  private async validarCedulaCreador(userId: string): Promise<void> {
    try {
      const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { cedula: true, cedulaVerificada: true },
      });
      if (!u?.cedula || u.cedulaVerificada != null) return; // ya validada o sin cédula
      const parsed = parseCedula(u.cedula);
      if (!parsed.valid || !parsed.data) return;
      const r = await this.cedula.verificar(parsed.data.tipo, parsed.data.numero);
      if (!r) return; // API caída/sin config → reintenta en el próximo centro
      await prisma.usuario.update({
        where: { id: userId },
        data: { cedulaVerificada: r.existe, cedulaNombre: r.nombre, cedulaVerificadaEn: new Date() },
      });
    } catch {
      /* best-effort */
    }
  }

  private buildWhere(q: ListCentrosQueryDto): Prisma.CentroWhereInput {
    return {
      ...(q.q && {
        OR: [
          { nombre: { contains: q.q, mode: "insensitive" } },
          { ciudad: { contains: q.q, mode: "insensitive" } },
        ],
      }),
      ...(q.soloAbiertos && { recibiendoAhora: true }),
      ...(q.urgenciaAlta && { insumos: { some: { nivel: NivelInsumo.URGENTE } } }),
      ...(q.verificado && { verificacion: EstadoVerificacion.VERIFICADO }),
    };
  }

  // Directorio público. Cacheado por filtros+página (key versionada). Ordena por
  // proximidad si vienen lat/lng (Haversine en memoria, ver ceiling en geo.ts).
  async list(q: ListCentrosQueryDto): Promise<CentrosPage> {
    const page = q.page ?? PAGINATION.defaultPage;
    const limit = q.limit ?? PAGINATION.defaultLimit;
    const version = await this.redis.centrosVersion();
    const key = `${CACHE.centrosListPrefix}:v${version}:${JSON.stringify({
      page,
      limit,
      q: q.q ?? null,
      lat: q.lat ?? null,
      lng: q.lng ?? null,
      radiusKm: q.radiusKm ?? null,
      soloAbiertos: q.soloAbiertos ?? false,
      urgenciaAlta: q.urgenciaAlta ?? false,
      verificado: q.verificado ?? false,
    })}`;

    return this.redis.cached(key, TTL.centrosList, () =>
      this.query(q, page, limit),
    );
  }

  // Todos los centros con coordenadas, para el mapa público. Payload mínimo.
  // Cacheado (versionado): es público y de alto tráfico → evita pegarle a la DB
  // en cada carga del mapa. ponytail: scan full-table con cap 1000.
  async mapaCoords(): Promise<MapaPunto[]> {
    const version = await this.redis.centrosVersion();
    return this.redis.cached(`${CACHE.centrosMapaPrefix}:v${version}`, TTL.centrosMapa, async () => {
      const rows = await prisma.centro.findMany({
        where: { latitud: { not: null }, longitud: { not: null } },
        select: { id: true, nombre: true, ciudad: true, latitud: true, longitud: true, recibiendoAhora: true },
        take: 1000,
      });
      return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        ciudad: r.ciudad,
        latitud: r.latitud!,
        longitud: r.longitud!,
        recibiendoAhora: r.recibiendoAhora,
      }));
    });
  }

  private async query(
    q: ListCentrosQueryDto,
    page: number,
    limit: number,
  ): Promise<CentrosPage> {
    const where = this.buildWhere(q);
    const conCoords = q.lat != null && q.lng != null;

    // Sin geolocalización: paginación en DB pura.
    if (!conCoords) {
      const [rows, total] = await Promise.all([
        prisma.centro.findMany({
          where,
          select: cardSelect,
          orderBy: { creadoEn: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.centro.count({ where }),
      ]);
      return {
        items: rows.map((r) => toCard(r, null)),
        page,
        limit,
        total,
        hasNext: page * limit < total,
      };
    }

    // Con geolocalización: prefiltro (bounding box si hay radio) + orden Haversine
    // en memoria + slice de la página. `total` es exacto hasta candidateCap.
    const box =
      q.radiusKm != null ? boundingBox(q.lat!, q.lng!, q.radiusKm) : null;
    const candidatos = await prisma.centro.findMany({
      where: {
        ...where,
        ...(box && {
          latitud: { gte: box.minLat, lte: box.maxLat },
          longitud: { gte: box.minLng, lte: box.maxLng },
        }),
      },
      select: { ...cardSelect, latitud: true, longitud: true },
      take: PAGINATION.candidateCap, // ponytail: ver tope en constants/pagination
    });

    let ordenados = sortByProximity(candidatos, q.lat!, q.lng!);
    if (q.radiusKm != null) {
      ordenados = ordenados.filter(
        (c) => c.distanciaKm != null && c.distanciaKm <= q.radiusKm!,
      );
    }
    const total = ordenados.length;
    const slice = ordenados.slice((page - 1) * limit, page * limit);
    return {
      items: slice.map((c) => toCard(c, c.distanciaKm)),
      page,
      limit,
      total,
      hasNext: page * limit < total,
    };
  }

  async create(userId: string, dto: CreateCentroDto) {
    // IdentidadGuard already guarantees the Usuario exists with a complete identity.
    const { insumos, ...datos } = dto;
    // Agrupa el inventario inicial por nombre (case-insensitive) para no duplicar
    // insumos en un mismo payload; mismo criterio que `recibir`.
    const seed = new Map<string, { nombre: string; categoria: CategoriaInsumo | null; cantidad: number }>();
    for (const it of insumos ?? []) {
      const nombre = it.nombre.trim();
      const prev = seed.get(nombre.toLowerCase());
      if (prev) prev.cantidad += it.cantidad;
      else seed.set(nombre.toLowerCase(), { nombre, categoria: it.categoria ?? null, cantidad: it.cantidad });
    }

    const centro = await prisma.$transaction(async (tx) => {
      const c = await tx.centro.create({ data: datos });
      await tx.voluntario.create({
        data: { usuarioId: userId, centroId: c.id, rol: RolVoluntario.JEFE },
      });
      // Carga inicial: cada insumo se crea en 0 y se mueve vía Historial (regla de
      // oro). tipo CARGA_INICIAL para no contarlo como donación. cantidad 0 igual
      // crea el insumo y su movimiento (registro de que existe sin stock).
      for (const it of seed.values()) {
        const insumo = await tx.insumo.create({
          data: { centroId: c.id, nombre: it.nombre, categoria: it.categoria, cantidadTotal: 0 },
          select: { id: true },
        });
        await tx.historial.create({
          data: { insumoId: insumo.id, usuarioId: userId, cantidad: it.cantidad, tipo: TipoMovimiento.CARGA_INICIAL },
        });
        await tx.insumo.update({
          where: { id: insumo.id },
          data: { cantidadTotal: { increment: it.cantidad } },
        });
      }
      return c;
    });
    await this.redis.bumpCentros();
    void this.validarCedulaCreador(userId); // CEN-23: en segundo plano
    void this.email.notificarCentroNuevo(centro); // avisa a moderadores, best-effort
    return centro;
  }

  // Centros donde el usuario es voluntario. Alimenta el dashboard "Mi Centro"
  // (inventario completo + conteo de voluntarios). Sin cache: data personal y poco
  // voluminosa; debe reflejar movimientos al instante.
  async mias(userId: string): Promise<MiCentro[]> {
    const rows = await prisma.centro.findMany({
      where: { voluntarios: { some: { usuarioId: userId } } },
      select: miCentroSelect(userId),
      orderBy: { creadoEn: "desc" },
    });
    return rows.map(toMiCentro);
  }

  // Detalle de un centro (solo miembros, garantizado por VoluntarioGuard). Sin
  // cache: refleja inventario al instante. `cantidadTotal` se expone para lectura.
  async detalle(userId: string, centroId: string): Promise<CentroDetalle> {
    // Donaciones recibidas = movimientos tipo DONACION de los insumos del centro.
    // La carga inicial (CARGA_INICIAL) y ajustes (AJUSTE) no cuentan como donación.
    const [row, donaciones] = await Promise.all([
      prisma.centro.findUniqueOrThrow({
        where: { id: centroId },
        select: detalleSelect(userId),
      }),
      prisma.historial.count({
        where: { tipo: TipoMovimiento.DONACION, insumo: { centroId } },
      }),
    ]);
    return toCentroDetalle(row, donaciones);
  }

  // Detalle público (sin guard): cualquiera puede ver un centro del directorio.
  // Cacheado por id (versionado): página pública → evita una query por vista.
  // Los 404 no se cachean (el throw corta antes del set).
  async detallePublico(centroId: string): Promise<CentroDetallePublico> {
    const version = await this.redis.centrosVersion();
    return this.redis.cached(
      `${CACHE.centrosPublicoPrefix}:v${version}:${centroId}`,
      TTL.centrosPublico,
      async () => {
        const row = await prisma.centro.findUnique({
          where: { id: centroId },
          select: publicoSelect,
        });
        if (!row) throw new NotFoundException("Centro no encontrado");
        return toDetallePublico(row);
      },
    );
  }

  // Datos principales (solo JEFE, garantizado por JefeGuard). Actualiza solo los
  // campos enviados; bumpCentros porque nombre/ciudad/estado/direccion aparecen en
  // el directorio. Nunca toca cantidadTotal (regla de oro).
  async actualizar(centroId: string, dto: UpdateCentroDto) {
    const centro = await prisma.centro.update({ where: { id: centroId }, data: dto });
    await this.redis.bumpCentros();
    return centro;
  }

  // Estado operativo (cualquier voluntario). bumpCentros porque recibiendoAhora
  // alimenta el filtro soloAbiertos del directorio.
  async actualizarOperativo(centroId: string, dto: UpdateOperativoDto) {
    const centro = await prisma.centro.update({ where: { id: centroId }, data: dto });
    await this.redis.bumpCentros();
    return centro;
  }

  // Umbrales por insumo (solo JEFE). Valida pertenencia al centro y coherencia
  // (urgente < suficiente). Recalcula `nivel` con el stock actual en la misma tx
  // (reusa calcularNivel). Si se limpia (null) calcularNivel devuelve null y el
  // nivel no se toca: el insumo vuelve a manual. bumpCentros: el badge va al directorio.
  async actualizarUmbrales(centroId: string, dto: UpdateUmbralesDto) {
    const ids = dto.insumos.map((f) => f.insumoId);
    const propios = await prisma.insumo.findMany({
      where: { id: { in: ids }, centroId },
      select: { id: true, cantidadTotal: true },
    });
    const owned = new Map(propios.map((i) => [i.id, i]));

    for (const f of dto.insumos) {
      if (!owned.has(f.insumoId))
        throw new BadRequestException("Insumo no pertenece al centro");
      const u = f.umbralUrgente ?? null;
      const s = f.umbralSuficiente ?? null;
      if (u != null && s != null && u >= s)
        throw new BadRequestException("umbralUrgente debe ser menor que umbralSuficiente");
    }

    await prisma.$transaction(
      dto.insumos.map((f) => {
        const u = f.umbralUrgente ?? null;
        const s = f.umbralSuficiente ?? null;
        const nivel = calcularNivel(owned.get(f.insumoId)!.cantidadTotal, u, s);
        return prisma.insumo.update({
          where: { id: f.insumoId },
          data: { umbralUrgente: u, umbralSuficiente: s, ...(nivel != null ? { nivel } : {}) },
        });
      }),
    );
    await this.redis.bumpCentros();
    return { ok: true, actualizados: dto.insumos.length };
  }

  // Miembros de un centro (solo JEFE, garantizado por JefeGuard). El JEFE primero
  // ("JEFE" < "VOLUNTARIO"), luego por antigüedad. Sin cache: data sensible y chica.
  async listarVoluntarios(centroId: string): Promise<VoluntarioItem[]> {
    const rows = await prisma.voluntario.findMany({
      where: { centroId },
      select: voluntarioSelect,
      orderBy: [{ rol: "asc" }, { asignadoEn: "asc" }],
    });
    return rows.map(toVoluntarioItem);
  }

  // Remover un voluntario (solo JEFE). Identificado por Voluntario.id (nunca por
  // fingerprint). Valida pertenencia al centro (evita borrado cruzado) y prohíbe
  // remover al JEFE/dueño. bumpCentros: el conteo viaja en el directorio y el detalle.
  async removerVoluntario(centroId: string, voluntarioId: string): Promise<{ ok: true }> {
    const link = await prisma.voluntario.findUnique({
      where: { id: voluntarioId },
      select: { centroId: true, rol: true },
    });
    if (!link || link.centroId !== centroId)
      throw new NotFoundException("Voluntario no encontrado en este centro");
    if (link.rol === RolVoluntario.JEFE)
      throw new BadRequestException("No podés remover al jefe del centro");

    await prisma.voluntario.delete({ where: { id: voluntarioId } });
    await this.redis.bumpCentros();
    return { ok: true };
  }

  // Lista para moderación (solo equipo). Si se filtra por `estado`, igual se
  // incluyen los centros con reportes (aunque ya estén verificados) para revisión.
  // Ordena: reportados primero, luego por más reportes, luego más nuevos.
  async moderacion(estado?: EstadoVerificacion): Promise<CentroModeracion[]> {
    const where: Prisma.CentroWhereInput = estado
      ? { OR: [{ verificacion: estado }, { reportes: { some: {} } }] }
      : {};
    const rows = await prisma.centro.findMany({
      where,
      select: moderacionSelect,
      orderBy: { creadoEn: "desc" },
    });
    return rows
      .map(toModeracion)
      .sort(
        (a, b) =>
          Number(b.reportado) - Number(a.reportado) ||
          b.reportesCount - a.reportesCount ||
          b.creadoEn.getTime() - a.creadoEn.getTime(),
      );
  }

  // Reporte comunitario anónimo (por fingerprint). Upsert: 1 por dispositivo por
  // centro (re-reportar actualiza el motivo). No auto-oculta: solo prioriza al equipo.
  async reportar(
    centroId: string,
    fingerprint: string,
    motivo: MotivoReporte,
    comentario?: string,
  ): Promise<{ ok: true }> {
    await prisma.reporte.upsert({
      where: { centroId_fingerprint: { centroId, fingerprint } },
      create: { centroId, fingerprint, motivo, comentario: comentario ?? null },
      update: { motivo, comentario: comentario ?? null, creadoEn: new Date() },
    });
    return { ok: true };
  }

  // Marcar verificado/rechazado (solo equipo). Registra qué admin lo hizo
  // (accountability). bumpCentros: el badge viaja en el directorio.
  async verificar(
    centroId: string,
    estado: EstadoVerificacion,
    adminId?: string,
  ): Promise<{ ok: true }> {
    await prisma.centro.update({
      where: { id: centroId },
      data: { verificacion: estado, verificadoEn: new Date(), verificadoPorId: adminId ?? null },
    });
    await this.redis.bumpCentros();
    return { ok: true };
  }

  // Guardar la foto del local (data URL base64) en disco y apuntar fotoUrl.
  // ponytail: disco local; mover a object storage para prod multi-instancia.
  async setFoto(centroId: string, dataUrl: string): Promise<{ fotoUrl: string }> {
    const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!m) throw new BadRequestException("Formato de imagen inválido (png, jpg o webp)");
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 3 * 1024 * 1024) throw new BadRequestException("La imagen supera 3 MB");

    const dir = join(process.cwd(), "uploads", "centros");
    mkdirSync(dir, { recursive: true });
    const filename = `${centroId}-${Date.now()}.${ext}`;
    writeFileSync(join(dir, filename), buf);

    const fotoUrl = `/uploads/centros/${filename}`;
    await prisma.centro.update({ where: { id: centroId }, data: { fotoUrl } });
    await this.redis.bumpCentros();
    return { fotoUrl };
  }
}

@Controller("centros")
export class CentrosController {
  constructor(private readonly service: CentrosService) {}

  // Directorio público (también "solo observar"). Sin guard: cualquiera puede ver.
  @Get()
  list(@Query() query: ListCentrosQueryDto) {
    return this.service.list(query);
  }

  // Centros del usuario identificado (dashboard "Mi Centro"). GET /centros/mios.
  @Get("mios")
  @UseGuards(IdentidadGuard)
  mias(@Req() req: any) {
    return this.service.mias(userIdOf(req));
  }

  // Panel de moderación (solo equipo, token admin). DEBE ir antes de ":centroId".
  @Get("moderacion")
  @UseGuards(AdminGuard)
  moderacion(@Query("estado") estado?: string) {
    const valido =
      estado && (Object.values(EstadoVerificacion) as string[]).includes(estado)
        ? (estado as EstadoVerificacion)
        : undefined;
    return this.service.moderacion(valido);
  }

  // Mapa público de centros con coordenadas. Literal antes de ":centroId".
  @Get("mapa")
  mapa() {
    return this.service.mapaCoords();
  }

  // Identified users only. Rate-limited (spec §6.5).
  @Post()
  @UseGuards(RateLimitGuard, IdentidadGuard)
  create(@Req() req: any, @Body() dto: CreateCentroDto) {
    return this.service.create(userIdOf(req), dto);
  }

  // Detalle público (directorio). Sin guard: ruta distinta a la de miembros.
  @Get(":centroId/publico")
  detallePublico(@Param("centroId") centroId: string) {
    return this.service.detallePublico(centroId);
  }

  // Detalle del centro (dashboard de miembros). DEBE declararse después de "mios"
  // para que el literal no caiga en el param :centroId.
  @Get(":centroId")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  detalle(@Req() req: any, @Param("centroId") centroId: string) {
    return this.service.detalle(userIdOf(req), centroId);
  }

  // Editar datos principales: solo el JEFE.
  @Patch(":centroId")
  @UseGuards(IdentidadGuard, JefeGuard)
  actualizar(@Param("centroId") centroId: string, @Body() dto: UpdateCentroDto) {
    return this.service.actualizar(centroId, dto);
  }

  // Editar estado operativo: cualquier voluntario del centro.
  @Patch(":centroId/operativo")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  actualizarOperativo(@Param("centroId") centroId: string, @Body() dto: UpdateOperativoDto) {
    return this.service.actualizarOperativo(centroId, dto);
  }

  // Configurar umbrales por insumo (nivel automático): solo el JEFE.
  @Patch(":centroId/umbrales")
  @UseGuards(IdentidadGuard, JefeGuard)
  actualizarUmbrales(@Param("centroId") centroId: string, @Body() dto: UpdateUmbralesDto) {
    return this.service.actualizarUmbrales(centroId, dto);
  }

  // Verificar / rechazar un centro: solo el equipo (sesión JWT de admin).
  @Patch(":centroId/verificacion")
  @UseGuards(AdminGuard)
  verificar(@Req() req: any, @Param("centroId") centroId: string, @Body() dto: VerificarDto) {
    return this.service.verificar(centroId, dto.estado, req.adminId);
  }

  // Subir la foto del local/cartel: solo el JEFE del centro. Rate-limited: la
  // imagen va en base64 (hasta 3 MB) → frena spam de uploads en disco/CPU.
  @Post(":centroId/foto")
  @UseGuards(RateLimitGuard, IdentidadGuard, JefeGuard)
  subirFoto(@Param("centroId") centroId: string, @Body() dto: FotoDto) {
    return this.service.setFoto(centroId, dto.foto);
  }

  // Reportar un centro inválido: anónimo (x-fingerprint o IP), sin identidad. Rate-limited.
  @Post(":centroId/reportes")
  @UseGuards(RateLimitGuard)
  reportar(@Req() req: any, @Param("centroId") centroId: string, @Body() dto: ReporteDto) {
    const fp: string = req.header("x-fingerprint") || req.ip || "anon";
    return this.service.reportar(centroId, fp, dto.motivo, dto.comentario);
  }

  // Gestión de voluntarios: listar miembros del centro. Solo el JEFE.
  @Get(":centroId/voluntarios")
  @UseGuards(IdentidadGuard, JefeGuard)
  listarVoluntarios(@Param("centroId") centroId: string) {
    return this.service.listarVoluntarios(centroId);
  }

  // Gestión de voluntarios: remover un miembro por Voluntario.id. Solo el JEFE.
  @Delete(":centroId/voluntarios/:voluntarioId")
  @UseGuards(IdentidadGuard, JefeGuard)
  removerVoluntario(
    @Param("centroId") centroId: string,
    @Param("voluntarioId") voluntarioId: string,
  ) {
    return this.service.removerVoluntario(centroId, voluntarioId);
  }
}
