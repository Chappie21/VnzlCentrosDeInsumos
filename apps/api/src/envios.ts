import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { prisma } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { IdentidadGuard, VoluntarioGuard, fingerprintOf } from "./guards";

class EnvioItemDto {
  @IsString() insumoId: string;
  @IsInt() @Min(1) cantidad: number;
}

class EnvioDto {
  // origen = el centro que opera. Nombre `centroId` para reusar VoluntarioGuard.
  @IsString() centroId: string;
  @IsOptional() @IsString() centroDestinoId?: string;
  @IsOptional() @IsString() destinoTexto?: string;
  @IsString() transporte: string;
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => EnvioItemDto)
  items: EnvioItemDto[];
}

@Injectable()
export class EnviosService {
  constructor(private readonly redis: RedisService) {}

  // Despacho: descuenta el origen creando Historial(-) ligados al Envio, en una
  // transacción todo-o-nada. Valida destino (centro XOR texto), pertenencia y stock.
  async crear(usuarioId: string, dto: EnvioDto) {
    const destinoTexto = dto.destinoTexto?.trim() || null;
    const tieneCentro = Boolean(dto.centroDestinoId);
    const tieneTexto = Boolean(destinoTexto);
    if (tieneCentro === tieneTexto)
      throw new BadRequestException("Indicá un centro destino O un destino de texto");

    // Agrupar por insumo para no descontar dos veces el mismo.
    const byId = new Map<string, number>();
    for (const it of dto.items) byId.set(it.insumoId, (byId.get(it.insumoId) ?? 0) + it.cantidad);
    const items = [...byId.entries()].map(([insumoId, cantidad]) => ({ insumoId, cantidad }));

    // Validar pertenencia al origen + stock ANTES de tocar nada.
    const insumos = await prisma.insumo.findMany({
      where: { id: { in: items.map((i) => i.insumoId) }, centroId: dto.centroId },
      select: { id: true, cantidadTotal: true },
    });
    const stockDe = new Map(insumos.map((i) => [i.id, i.cantidadTotal]));
    for (const it of items) {
      const stock = stockDe.get(it.insumoId);
      if (stock === undefined)
        throw new BadRequestException(`Insumo ${it.insumoId} no pertenece al centro origen`);
      if (it.cantidad > stock)
        throw new BadRequestException(`Stock insuficiente para el insumo ${it.insumoId}`);
    }

    const envio = await prisma.$transaction(async (tx) => {
      const e = await tx.envio.create({
        data: {
          centroOrigenId: dto.centroId,
          centroDestinoId: dto.centroDestinoId ?? null,
          destinoTexto,
          transporte: dto.transporte,
          creadoPorId: usuarioId,
        },
        select: { id: true },
      });
      for (const it of items) {
        // Regla de oro: cantidadTotal solo se mueve creando Historial.
        await tx.historial.create({
          data: { insumoId: it.insumoId, usuarioId, cantidad: -it.cantidad, envioId: e.id },
        });
        await tx.insumo.update({
          where: { id: it.insumoId },
          data: { cantidadTotal: { decrement: it.cantidad } },
        });
      }
      return e;
    });

    await this.redis.bumpCentros();
    return { id: envio.id };
  }

  // Guía pública de un envío (la abre el QR). No expone PII más allá del nombre.
  async guia(id: string) {
    const e = await prisma.envio.findUnique({
      where: { id },
      select: {
        id: true,
        transporte: true,
        creadoEn: true,
        destinoTexto: true,
        origen: { select: { nombre: true, ciudad: true, estado: true } },
        destino: { select: { nombre: true, ciudad: true } },
        creadoPor: { select: { nombre: true } },
        movimientos: { select: { cantidad: true, insumo: { select: { nombre: true } } } },
      },
    });
    if (!e) throw new NotFoundException("Envío no encontrado");

    return {
      id: e.id,
      creadoEn: e.creadoEn,
      transporte: e.transporte,
      despachadoPor: e.creadoPor?.nombre ?? null,
      origen: e.origen,
      destino: e.destino
        ? { nombre: e.destino.nombre, ciudad: e.destino.ciudad }
        : { texto: e.destinoTexto },
      items: e.movimientos.map((m) => ({ nombre: m.insumo.nombre, cantidad: Math.abs(m.cantidad) })),
    };
  }
}

@Controller("envios")
export class EnviosController {
  constructor(private readonly service: EnviosService) {}

  // Crear despacho. Solo voluntario del centro origen (VoluntarioGuard lee body.centroId).
  @Post()
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  crear(@Req() req: any, @Body() dto: EnvioDto) {
    return this.service.crear(fingerprintOf(req), dto);
  }

  // Guía pública (la abre el QR). Sin guard.
  @Get(":id")
  guia(@Param("id") id: string) {
    return this.service.guia(id);
  }
}
