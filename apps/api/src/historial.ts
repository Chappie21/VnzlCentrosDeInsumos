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
import { prisma, Prisma, CategoriaInsumo, TipoMovimiento, type NivelInsumo } from "@vnzl/database";
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

// Mueve el stock de varios insumos agrupando por monto: un UPDATE por monto
// distinto en vez de uno por insumo. `delta` es con signo (+ entrada, - salida) y
// debe coincidir con el Historial creado en la MISMA transacción (regla de oro).
// ponytail: el techo es N updates si todos los montos difieren; si eso pesa,
// reemplazar por un `UPDATE ... FROM (VALUES ...)` crudo.
export function incrementarStockOps(
  tx: Prisma.TransactionClient,
  deltas: { insumoId: string; delta: number }[],
) {
  const porMonto = new Map<number, string[]>();
  for (const d of deltas) {
    const ids = porMonto.get(d.delta);
    if (ids) ids.push(d.insumoId);
    else porMonto.set(d.delta, [d.insumoId]);
  }
  return [...porMonto].map(([delta, ids]) =>
    tx.insumo.updateMany({
      where: { id: { in: ids } },
      data: { cantidadTotal: { increment: delta } },
    }),
  );
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
    // `nivel` tiene 3 valores posibles: agrupamos por destino y mandamos un
    // updateMany por nivel (<= 3 queries) en vez de un update por insumo.
    const porNivel = new Map<NivelInsumo, string[]>();
    for (const i of insumos) {
      const nuevo = calcularNivel(i.cantidadTotal, i.umbralUrgente, i.umbralSuficiente);
      if (nuevo == null || nuevo === i.nivel) continue;
      const ids = porNivel.get(nuevo);
      if (ids) ids.push(i.id);
      else porNivel.set(nuevo, [i.id]);
    }
    await Promise.all(
      [...porNivel].map(([nivel, ids]) =>
        prisma.insumo.updateMany({ where: { id: { in: ids } }, data: { nivel } }),
      ),
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

    const claveDe = (nombre: string) => nombre.toLowerCase();

    // Todo dentro de UNA tx (todo-o-nada), pero en queries por lote y no por item:
    // 1 findMany + 1 createManyAndReturn + 1 historial.createMany + los increments
    // agrupados por monto.
    const insumoIds = await prisma.$transaction(async (tx) => {
      // Un solo lookup para todos los nombres. El OR de `equals` + mode insensitive
      // conserva exactamente la semántica del findFirst que había por item.
      const existentes = await tx.insumo.findMany({
        where: {
          centroId: dto.centroId,
          OR: items.map((it) => ({
            nombre: { equals: it.nombre, mode: "insensitive" as const },
          })),
        },
        select: { id: true, nombre: true },
      });
      const idPorNombre = new Map<string, string>();
      // Si el centro ya tiene dos insumos que solo difieren en mayúsculas, gana el
      // primero: mismo criterio que el findFirst anterior.
      for (const i of existentes) if (!idPorNombre.has(claveDe(i.nombre))) idPorNombre.set(claveDe(i.nombre), i.id);

      const nuevos = items.filter((it) => !idPorNombre.has(claveDe(it.nombre)));
      const yaExistian = items.filter((it) => idPorNombre.has(claveDe(it.nombre)));
      if (nuevos.length) {
        // Nacen con su cantidad ya puesta: su Historial se crea abajo, en esta misma
        // tx y por el mismo monto, así que cantidadTotal === suma(Historial) igual.
        const creados = await tx.insumo.createManyAndReturn({
          data: nuevos.map((it) => ({
            centroId: dto.centroId,
            nombre: it.nombre,
            categoria: it.categoria,
            cantidadTotal: it.cantidad,
          })),
          select: { id: true, nombre: true },
        });
        for (const i of creados) idPorNombre.set(claveDe(i.nombre), i.id);
      }

      // Regla de oro: cantidadTotal solo se mueve creando Historial dentro de la tx.
      await tx.historial.createMany({
        data: items.map((it) => ({
          insumoId: idPorNombre.get(claveDe(it.nombre))!,
          usuarioId,
          cantidad: it.cantidad,
        })),
      });
      // Solo los preexistentes necesitan mover el contador (los nuevos ya nacieron
      // con su cantidad).
      await Promise.all(
        incrementarStockOps(
          tx,
          yaExistian.map((it) => ({ insumoId: idPorNombre.get(claveDe(it.nombre))!, delta: it.cantidad })),
        ),
      );
      return items.map((it) => idPorNombre.get(claveDe(it.nombre))!);
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
