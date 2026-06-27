import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { prisma, Prisma, NivelInsumo, CategoriaInsumo } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { RateLimitGuard, IdentidadGuard, fingerprintOf } from "./guards";
import { boundingBox, sortByProximity } from "./geo";
import { PAGINATION, CACHE, TTL, NIVEL_ORDER } from "./constants";

// query strings -> boolean, preservando undefined cuando el param no viene
const toOptionalBool = () =>
  Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === "true" || value === "1",
  );

class CreateCentroDto {
  @IsString() nombre: string;
  @IsString() estado: string;
  @IsString() ciudad: string;
  @IsString() direccion: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitud?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitud?: number;
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
const miCentroSelect = {
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
} satisfies Prisma.CentroSelect;

type MiCentroRow = Prisma.CentroGetPayload<{ select: typeof miCentroSelect }>;

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
    insumos: c.insumos,
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
    const centro = await prisma.$transaction(async (tx) => {
      const c = await tx.centro.create({ data: dto });
      await tx.voluntario.create({
        data: { usuarioId: fingerprint, centroId: c.id },
      });
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
      select: miCentroSelect,
      orderBy: { creadoEn: "desc" },
    });
    return rows.map(toMiCentro);
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

  // Identified users only (fingerprint header). Rate-limited (spec §6.5).
  @Post()
  @UseGuards(RateLimitGuard, IdentidadGuard)
  create(@Req() req: any, @Body() dto: CreateCentroDto) {
    return this.service.create(fingerprintOf(req), dto);
  }
}
