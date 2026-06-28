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
import { prisma, Prisma, NivelInsumo, CategoriaInsumo, RolVoluntario, TipoMovimiento } from "@vnzl/database";
import { ESTADOS, municipiosDe } from "@vnzl/venezuela";
import { RedisService } from "./redis.service";
import { RateLimitGuard, IdentidadGuard, VoluntarioGuard, JefeGuard, fingerprintOf } from "./guards";
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
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InsumoInicialDto)
  insumos?: InsumoInicialDto[];
}

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
const miCentroSelect = (fingerprint: string) =>
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
    voluntarios: { where: { usuarioId: fingerprint }, select: { rol: true }, take: 1 },
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
const detalleSelect = (fingerprint: string) =>
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
    creadoEn: true,
    insumos: {
      select: { id: true, nombre: true, descripcion: true, nivel: true, categoria: true, cantidadTotal: true },
    },
    _count: { select: { voluntarios: true } },
    voluntarios: { where: { usuarioId: fingerprint }, select: { rol: true }, take: 1 },
  }) satisfies Prisma.CentroSelect;

type DetalleRow = Prisma.CentroGetPayload<{ select: ReturnType<typeof detalleSelect> }>;

export type InsumoDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  nivel: NivelInsumo;
  categoria: CategoriaInsumo | null;
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
    creadoEn: c.creadoEn,
    voluntarios: c._count.voluntarios,
    donaciones,
    rol: c.voluntarios[0]?.rol ?? RolVoluntario.VOLUNTARIO,
    insumos: c.insumos,
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

@Injectable()
export class CentrosService {
  constructor(private readonly redis: RedisService) {}

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
    })}`;

    return this.redis.cached(key, TTL.centrosList, () =>
      this.query(q, page, limit),
    );
  }

  // Todos los centros con coordenadas, para el mapa público. Payload mínimo.
  // ponytail: scan full-table con cap 1000; cachear/paginar si crece mucho.
  async mapaCoords(): Promise<MapaPunto[]> {
    const rows = await prisma.centro.findMany({
      where: { latitud: { not: null }, longitud: { not: null } },
      select: { id: true, nombre: true, ciudad: true, latitud: true, longitud: true },
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      ciudad: r.ciudad,
      latitud: r.latitud!,
      longitud: r.longitud!,
    }));
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

  async create(fingerprint: string, dto: CreateCentroDto) {
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
        data: { usuarioId: fingerprint, centroId: c.id, rol: RolVoluntario.JEFE },
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
          data: { insumoId: insumo.id, usuarioId: fingerprint, cantidad: it.cantidad, tipo: TipoMovimiento.CARGA_INICIAL },
        });
        await tx.insumo.update({
          where: { id: insumo.id },
          data: { cantidadTotal: { increment: it.cantidad } },
        });
      }
      return c;
    });
    await this.redis.bumpCentros();
    return centro;
  }

  // Centros donde el usuario es voluntario. Alimenta el dashboard "Mi Centro"
  // (inventario completo + conteo de voluntarios). Sin cache: data personal y poco
  // voluminosa; debe reflejar movimientos al instante.
  async mias(fingerprint: string): Promise<MiCentro[]> {
    const rows = await prisma.centro.findMany({
      where: { voluntarios: { some: { usuarioId: fingerprint } } },
      select: miCentroSelect(fingerprint),
      orderBy: { creadoEn: "desc" },
    });
    return rows.map(toMiCentro);
  }

  // Detalle de un centro (solo miembros, garantizado por VoluntarioGuard). Sin
  // cache: refleja inventario al instante. `cantidadTotal` se expone para lectura.
  async detalle(fingerprint: string, centroId: string): Promise<CentroDetalle> {
    // Donaciones recibidas = movimientos tipo DONACION de los insumos del centro.
    // La carga inicial (CARGA_INICIAL) y ajustes (AJUSTE) no cuentan como donación.
    const [row, donaciones] = await Promise.all([
      prisma.centro.findUniqueOrThrow({
        where: { id: centroId },
        select: detalleSelect(fingerprint),
      }),
      prisma.historial.count({
        where: { tipo: TipoMovimiento.DONACION, insumo: { centroId } },
      }),
    ]);
    return toCentroDetalle(row, donaciones);
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
    return this.service.mias(fingerprintOf(req));
  }

  // Mapa público de centros con coordenadas. Literal antes de ":centroId".
  @Get("mapa")
  mapa() {
    return this.service.mapaCoords();
  }

  // Identified users only (fingerprint header). Rate-limited (spec §6.5).
  @Post()
  @UseGuards(RateLimitGuard, IdentidadGuard)
  create(@Req() req: any, @Body() dto: CreateCentroDto) {
    return this.service.create(fingerprintOf(req), dto);
  }

  // Detalle del centro (dashboard de miembros). DEBE declararse después de "mios"
  // para que el literal no caiga en el param :centroId.
  @Get(":centroId")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  detalle(@Req() req: any, @Param("centroId") centroId: string) {
    return this.service.detalle(fingerprintOf(req), centroId);
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
