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
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { prisma } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { RateLimitGuard, IdentidadGuard, fingerprintOf } from "./guards";
import { sortByProximity } from "./geo";

class CreateCentroDto {
  @IsString() nombre: string;
  @IsString() estado: string;
  @IsString() ciudad: string;
  @IsString() direccion: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitud?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitud?: number;
}

@Injectable()
export class CentrosService {
  constructor(private readonly redis: RedisService) {}

  // Public directory. Cached in Redis (spec §4.1). Sorted by proximity if lat/lng given.
  async list(lat?: number, lng?: number) {
    const centros = await this.redis.cached("centros:list", 30, () =>
      prisma.centro.findMany({
        include: { insumos: { select: { id: true, nombre: true, cantidadTotal: true } } },
        orderBy: { creadoEn: "desc" },
      }),
    );
    if (lat == null || lng == null) return centros;
    return sortByProximity(centros, lat, lng);
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
    await this.redis.client.del("centros:list");
    return centro;
  }
}

@Controller("centros")
export class CentrosController {
  constructor(private readonly service: CentrosService) {}

  @Get()
  list(@Query("lat") lat?: string, @Query("lng") lng?: string) {
    return this.service.list(
      lat != null ? Number(lat) : undefined,
      lng != null ? Number(lng) : undefined,
    );
  }

  // Identified users only (fingerprint header). Rate-limited (spec §6.5).
  @Post()
  @UseGuards(RateLimitGuard, IdentidadGuard)
  create(@Req() req: any, @Body() dto: CreateCentroDto) {
    return this.service.create(fingerprintOf(req), dto);
  }
}
