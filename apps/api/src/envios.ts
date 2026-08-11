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
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { prisma, TipoMovimiento, RolVoluntario } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { IdentidadGuard, VoluntarioGuard, OptionalSesionGuard, userIdOf } from "./guards";

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
          data: { insumoId: it.insumoId, usuarioId, cantidad: -it.cantidad, envioId: e.id, tipo: TipoMovimiento.SALIDA },
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

  // Guía de un envío (la abre el QR). Manifiesto (origen/destino/ítems) es público;
  // la PII de personas (despachador + transporte/chofer) solo se agrega si el usuario
  // es JEFE del centro origen O destino.
  async guia(id: string, userId: string | null) {
    const e = await prisma.envio.findUnique({
      where: { id },
      select: {
        id: true,
        transporte: true,
        creadoEn: true,
        destinoTexto: true,
        centroOrigenId: true,
        centroDestinoId: true,
        origen: { select: { nombre: true, ciudad: true, estado: true } },
        destino: { select: { nombre: true, ciudad: true } },
        creadoPor: { select: { nombre: true } },
        movimientos: { select: { cantidad: true, insumo: { select: { nombre: true } } } },
      },
    });
    if (!e) throw new NotFoundException("Envío no encontrado");

    const base = {
      id: e.id,
      creadoEn: e.creadoEn,
      origen: e.origen,
      destino: e.destino
        ? { nombre: e.destino.nombre, ciudad: e.destino.ciudad }
        : { texto: e.destinoTexto },
      items: e.movimientos.map((m) => ({ nombre: m.insumo.nombre, cantidad: Math.abs(m.cantidad) })),
    };

    // ¿El usuario es JEFE del origen o del destino? Solo entonces ve la PII.
    const centros = [e.centroOrigenId, e.centroDestinoId].filter(Boolean) as string[];
    const esJefe =
      userId != null &&
      (await prisma.voluntario.findFirst({
        where: { usuarioId: userId, rol: RolVoluntario.JEFE, centroId: { in: centros } },
        select: { id: true },
      })) != null;

    if (!esJefe) return base;
    return { ...base, transporte: e.transporte, despachadoPor: e.creadoPor?.nombre ?? null };
  }
}

@Controller("envios")
export class EnviosController {
  constructor(private readonly service: EnviosService) {}

  // Crear despacho. Solo voluntario del centro origen (VoluntarioGuard lee body.centroId).
  @Post()
  @UseGuards(IdentidadGuard, VoluntarioGuard)
  crear(@Req() req: any, @Body() dto: EnvioDto) {
    return this.service.crear(userIdOf(req), dto);
  }

  // Guía (la abre el QR). Auth OPCIONAL: anónimo ve el manifiesto; el JEFE de
  // origen/destino ve además los datos del despachador/transporte.
  @Get(":id")
  @UseGuards(OptionalSesionGuard)
  @ApiTags("publico")
  @ApiOperation({
    summary: "Guía de un envío (la abre el QR). Manifiesto público; datos del despachador solo con token de JEFE de origen/destino.",
  })
  @ApiOkResponse({
    schema: {
      example: {
        id: "ckxyz...",
        creadoEn: "2026-06-27T12:00:00.000Z",
        origen: { nombre: "Centro Norte", ciudad: "Caracas", estado: "Distrito Capital" },
        destino: { nombre: "Centro Sur", ciudad: "Maracaibo" },
        items: [{ nombre: "Agua", cantidad: 5 }],
      },
    },
  })
  guia(@Req() req: any, @Param("id") id: string) {
    return this.service.guia(id, req.userId ?? null);
  }
}
