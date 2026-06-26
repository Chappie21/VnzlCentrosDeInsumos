import {
  Body,
  Controller,
  Injectable,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ArrayMinSize, IsInt, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { prisma, Prisma } from "@vnzl/database";
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

// "Regla de oro": cantidadTotal is never set directly — only moved via Historial.
// The create + increment run in ONE transaction so inventory can't drift (spec §6.2).
@Injectable()
export class HistorialService {
  constructor(private readonly redis: RedisService) {}

  private moveOps(tx: Prisma.TransactionClient, insumoId: string, usuarioId: string, cantidad: number) {
    return [
      tx.historial.create({ data: { insumoId, usuarioId, cantidad } }),
      tx.insumo.update({
        where: { id: insumoId },
        data: { cantidadTotal: { increment: cantidad } },
      }),
    ];
  }

  async addOne(usuarioId: string, m: MovimientoDto) {
    const [hist] = await prisma.$transaction(this.moveOps(prisma, m.insumoId, usuarioId, m.cantidad));
    await this.redis.client.del("centros:list");
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
    await this.redis.client.del("centros:list");
    return { ok: true, aplicados: dto.movimientos.length };
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
}
