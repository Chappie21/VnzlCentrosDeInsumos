import {
  Body,
  Controller,
  Injectable,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { prisma, Prisma, CategoriaInsumo, TipoMovimiento } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { IdentidadGuard, VoluntarioGuard, fingerprintOf } from "./guards";

class MovimientoDto {
  @IsString() insumoId: string;
  @IsInt() cantidad: number; // + entrada, - salida
}

class BatchDto {
  @IsString() centroId: string;
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => MovimientoDto)
  movimientos: MovimientoDto[];
}

// Donación escaneada desde un QR de donante: insumos por NOMBRE (el donante no
// conoce insumoId). El centro hace upsert por nombre. Ver CEN-8 / CEN-19.
class RecibirItemDto {
  @IsString() nombre: string;
  @IsOptional() @IsEnum(CategoriaInsumo) categoria?: CategoriaInsumo;
  @IsInt() @Min(1) cantidad: number;
}

class RecibirDto {
  @IsString() centroId: string;
  @IsOptional() @IsEnum(TipoMovimiento) tipo?: TipoMovimiento; // default DONACION; INICIAL = carga al crear
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => RecibirItemDto)
  items: RecibirItemDto[];
}

// "Regla de oro": cantidadTotal is never set directly — only moved via Historial.
// The create + increment run in ONE transaction so inventory can't drift (spec §6.2).
@Injectable()
export class HistorialService {
  constructor(private readonly redis: RedisService) {}

  private moveOps(
    tx: Prisma.TransactionClient,
    insumoId: string,
    usuarioId: string,
    cantidad: number,
    tipo: TipoMovimiento = TipoMovimiento.AJUSTE,
  ) {
    return [
      tx.historial.create({ data: { insumoId, usuarioId, cantidad, tipo } }),
      tx.insumo.update({
        where: { id: insumoId },
        data: { cantidadTotal: { increment: cantidad } },
      }),
    ];
  }

  async addOne(usuarioId: string, m: MovimientoDto) {
    const [hist] = await prisma.$transaction(this.moveOps(prisma, m.insumoId, usuarioId, m.cantidad));
    await this.redis.bumpCentros();
    return hist;
  }

  // QR drop-off: all-or-nothing batch (spec §6.3). One bad insumo -> whole thing rolls back.
  async batch(usuarioId: string, dto: BatchDto) {
    const insumos = await prisma.insumo.findMany({
      where: { id: { in: dto.movimientos.map((m) => m.insumoId) }, centroId: dto.centroId },
      select: { id: true },
    });
    const valid = new Set(insumos.map((i) => i.id));
    const bad = dto.movimientos.find((m) => !valid.has(m.insumoId));
    if (bad) throw new BadRequestException(`Insumo ${bad.insumoId} no pertenece al centro`);

    await prisma.$transaction(
      dto.movimientos.flatMap((m) => this.moveOps(prisma, m.insumoId, usuarioId, m.cantidad)),
    );
    await this.redis.bumpCentros();
    return { ok: true, aplicados: dto.movimientos.length };
  }

  // Recepción de una donación escaneada (insumos por nombre): upsert por
  // (centroId, nombre) case-insensitive + entrada en Historial. Todo-o-nada.
  async recibir(usuarioId: string, dto: RecibirDto) {
    // Agrupar por nombre (case-insensitive) para no duplicar insumos en un mismo QR.
    const byKey = new Map<string, { nombre: string; categoria: CategoriaInsumo | null; cantidad: number }>();
    for (const it of dto.items) {
      const nombre = it.nombre.trim();
      const key = nombre.toLowerCase();
      const prev = byKey.get(key);
      if (prev) prev.cantidad += it.cantidad;
      else byKey.set(key, { nombre, categoria: it.categoria ?? null, cantidad: it.cantidad });
    }
    const items = [...byKey.values()];

    const tipo = dto.tipo ?? TipoMovimiento.DONACION;
    // INICIAL es una carga de una sola vez: solo si el centro no tiene movimientos aún.
    if (tipo === TipoMovimiento.INICIAL) {
      const previos = await prisma.historial.count({ where: { insumo: { centroId: dto.centroId } } });
      if (previos > 0)
        throw new BadRequestException(
          "El inventario inicial solo se carga al crear el centro; este centro ya tiene movimientos.",
        );
    }

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        let insumo = await tx.insumo.findFirst({
          where: { centroId: dto.centroId, nombre: { equals: it.nombre, mode: "insensitive" } },
          select: { id: true },
        });
        if (!insumo) {
          insumo = await tx.insumo.create({
            data: {
              centroId: dto.centroId,
              nombre: it.nombre,
              categoria: it.categoria,
              cantidadTotal: 0,
            },
            select: { id: true },
          });
        }
        // Regla de oro: cantidadTotal solo se mueve creando Historial dentro de la tx.
        await tx.historial.create({
          data: { insumoId: insumo.id, usuarioId, cantidad: it.cantidad, tipo },
        });
        await tx.insumo.update({
          where: { id: insumo.id },
          data: { cantidadTotal: { increment: it.cantidad } },
        });
      }
    });
    await this.redis.bumpCentros();
    return { ok: true, recibidos: items.length };
  }
}

@Controller("historial")
export class HistorialController {
  constructor(private readonly service: HistorialService) {}

  // Single manual movement. Caller must be a volunteer of the centro that owns the insumo.
  // ponytail: VoluntarioGuard checks body.centroId, so the single route also carries it.
  @Post()
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  add(@Req() req: any, @Body() body: { centroId: string } & MovimientoDto) {
    return this.service.addOne(fingerprintOf(req), body);
  }

  // QR approval. Volunteer-only, transactional batch.
  @Post("batch")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  batch(@Req() req: any, @Body() dto: BatchDto) {
    return this.service.batch(fingerprintOf(req), dto);
  }

  // Recepción por QR de donante (insumos por nombre). Solo voluntario del centro.
  @Post("recibir")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  recibir(@Req() req: any, @Body() dto: RecibirDto) {
    return this.service.recibir(fingerprintOf(req), dto);
  }
}
