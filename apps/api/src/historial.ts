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
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { prisma, Prisma, CategoriaInsumo, TipoMovimiento } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { IdentidadGuard, VoluntarioGuard, JefeGuard, userIdOf } from "./guards";
import { calcularNivel } from "./constants/insumos";

class MovimientoDto {
  @IsString() insumoId: string;
  @IsInt() cantidad: number; // + entrada, - salida
}

class AddDto extends MovimientoDto {
  @IsString() centroId: string;
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
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => RecibirItemDto)
  items: RecibirItemDto[];
}

// Ajuste manual de stock (solo JEFE): corrige el conteo de un insumo. `cantidad`
// es el delta (+/-), nunca 0 (se valida en el service). `motivo` no se persiste
// (no hay columna). ponytail: si se quiere auditar el motivo, agregar
// `Historial.motivo String?` y guardarlo en moveOps.
class AjusteDto {
  @IsString() centroId: string;
  @IsString() insumoId: string;
  @IsInt() cantidad: number; // delta +/- (≠ 0)
  @IsOptional() @IsString() @MaxLength(200) motivo?: string;
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
    tipo: TipoMovimiento = TipoMovimiento.DONACION,
  ) {
    return [
      tx.historial.create({ data: { insumoId, usuarioId, cantidad, tipo } }),
      tx.insumo.update({
        where: { id: insumoId },
        data: { cantidadTotal: { increment: cantidad } },
      }),
    ];
  }

  // Recalcula `nivel` de los insumos cuyos umbrales aplican, tras mover stock.
  // ponytail: corre justo después de la $transaction de stock, no dentro. El nivel
  // es cosmético (no afecta la regla de oro de cantidadTotal), así que una ventana
  // de carrera ínfima es aceptable y converge. Si molesta, mover dentro de cada tx.
  private async recalcularNiveles(insumoIds: string[]) {
    const insumos = await prisma.insumo.findMany({
      where: { id: { in: insumoIds } },
      select: { id: true, cantidadTotal: true, nivel: true, umbralUrgente: true, umbralSuficiente: true },
    });
    await Promise.all(
      insumos.map((i) => {
        const nuevo = calcularNivel(i.cantidadTotal, i.umbralUrgente, i.umbralSuficiente);
        if (nuevo == null || nuevo === i.nivel) return Promise.resolve();
        return prisma.insumo.update({ where: { id: i.id }, data: { nivel: nuevo } });
      }),
    );
  }

  // Ajuste manual (solo JEFE). Valida pertenencia al centro y que el stock no
  // quede negativo. Movimiento etiquetado AJUSTE (no cuenta como donación).
  async ajuste(usuarioId: string, dto: AjusteDto) {
    if (dto.cantidad === 0)
      throw new BadRequestException("El ajuste no puede ser 0");

    const insumo = await prisma.insumo.findUnique({
      where: { id: dto.insumoId },
      select: { centroId: true, cantidadTotal: true },
    });
    if (!insumo || insumo.centroId !== dto.centroId)
      throw new BadRequestException("Insumo no pertenece al centro");
    if (insumo.cantidadTotal + dto.cantidad < 0)
      throw new BadRequestException("El stock no puede quedar negativo");

    const [hist] = await prisma.$transaction(
      this.moveOps(prisma, dto.insumoId, usuarioId, dto.cantidad, TipoMovimiento.AJUSTE),
    );
    await this.recalcularNiveles([dto.insumoId]);
    await this.redis.bumpCentros();
    return hist;
  }

  async addOne(usuarioId: string, m: AddDto) {
    const insumo = await prisma.insumo.findUnique({
      where: { id: m.insumoId },
      select: { centroId: true },
    });
    if (!insumo || insumo.centroId !== m.centroId) {
      throw new BadRequestException("Insumo no pertenece al centro");
    }

    const [hist] = await prisma.$transaction(this.moveOps(prisma, m.insumoId, usuarioId, m.cantidad));
    await this.recalcularNiveles([m.insumoId]);
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
    await this.recalcularNiveles(dto.movimientos.map((m) => m.insumoId));
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

    const insumoIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
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
          data: { insumoId: insumo.id, usuarioId, cantidad: it.cantidad },
        });
        await tx.insumo.update({
          where: { id: insumo.id },
          data: { cantidadTotal: { increment: it.cantidad } },
        });
        ids.push(insumo.id);
      }
      return ids;
    });
    await this.recalcularNiveles(insumoIds);
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
  add(@Req() req: any, @Body() body: AddDto) {
    return this.service.addOne(userIdOf(req), body);
  }

  // QR approval. Volunteer-only, transactional batch.
  @Post("batch")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  batch(@Req() req: any, @Body() dto: BatchDto) {
    return this.service.batch(userIdOf(req), dto);
  }

  // Recepción por QR de donante (insumos por nombre). Solo voluntario del centro.
  @Post("recibir")
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  recibir(@Req() req: any, @Body() dto: RecibirDto) {
    return this.service.recibir(userIdOf(req), dto);
  }

  // Ajuste manual de stock. Solo el JEFE del centro (JefeGuard lee body.centroId).
  @Post("ajuste")
  @UseGuards(IdentidadGuard, JefeGuard)
  ajuste(@Req() req: any, @Body() dto: AjusteDto) {
    return this.service.ajuste(userIdOf(req), dto);
  }
}
