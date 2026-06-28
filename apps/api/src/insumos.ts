import {
  Body,
  Controller,
  Injectable,
  Param,
  Patch,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { prisma, NivelInsumo, CategoriaInsumo } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { IdentidadGuard, fingerprintOf } from "./guards";

// Metadata editable de un insumo (cualquier voluntario del centro). NO incluye
// `cantidadTotal`: la regla de oro la mueve solo Historial. ValidationPipe
// (whitelist:true) descarta cualquier campo extra, así que enviarla es no-op.
export class UpdateInsumoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsEnum(NivelInsumo) nivel?: NivelInsumo;
  @IsOptional() @IsEnum(CategoriaInsumo) categoria?: CategoriaInsumo;
}

@Injectable()
export class InsumosService {
  constructor(private readonly redis: RedisService) {}

  // La membresía se valida aquí (lazy correcto): el centroId del insumo no está en
  // params, así que cargamos el insumo, obtenemos su centroId y verificamos que el
  // usuario sea Voluntario. Si cambia `nivel` hacemos bumpCentros (alimenta el
  // filtro urgenciaAlta del directorio). Nunca tocamos cantidadTotal.
  async actualizar(fingerprint: string, insumoId: string, dto: UpdateInsumoDto) {
    const insumo = await prisma.insumo.findUnique({
      where: { id: insumoId },
      select: { centroId: true, nivel: true },
    });
    if (!insumo) throw new NotFoundException("Insumo no encontrado");

    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: fingerprint, centroId: insumo.centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");

    const actualizado = await prisma.insumo.update({ where: { id: insumoId }, data: dto });
    if (dto.nivel !== undefined && dto.nivel !== insumo.nivel) await this.redis.bumpCentros();
    return actualizado;
  }
}

@Controller("insumos")
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  // Editar metadata. Identidad completa requerida; la membresía se valida en el
  // service porque el centroId vive en el insumo, no en la ruta.
  @Patch(":id")
  @UseGuards(IdentidadGuard)
  actualizar(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateInsumoDto) {
    return this.service.actualizar(fingerprintOf(req), id, dto);
  }
}
