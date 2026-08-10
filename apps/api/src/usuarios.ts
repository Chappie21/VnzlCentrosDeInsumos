import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { prisma } from "@vnzl/database";
import { normalizarDocumento, normalizarTelefono, PAISES, type Pais } from "@vnzl/paises";
import { CedulaService } from "./cedula";
import { IsDocumentoDePais, IsTelefonoDePais } from "./validators";
import {
  IdentidadGuard,
  JefeGuard,
  RateLimitGuard,
  SesionGuard,
  userIdOf,
  identidadCompleta,
} from "./guards";
import { INVITACION } from "./constants";

class OnboardDto {
  @IsIn([...PAISES]) pais: Pais;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  nombre: string;

  @Transform(({ value, obj }) =>
    typeof value === "string" && obj?.pais ? normalizarDocumento(obj.pais, value) : value,
  )
  @IsDocumentoDePais()
  cedula: string;

  @Transform(({ value }) => (typeof value === "string" ? normalizarTelefono(value) : value))
  @IsTelefonoDePais()
  telefono: string;
}

// Solo el JEFE puede mintear: el centro objetivo viaja en el body.
class InviteDto {
  @IsString()
  @IsNotEmpty()
  centroId: string;
}

// Token de invitación a canjear por quien se une.
class AceptarInvitacionDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cedula: CedulaService,
  ) {}

  // Public profile of the current user (spec §3). Returns nulls for incomplete identity.
  async me(userId: string) {
    const u = await prisma.usuario.findUnique({ where: { id: userId } });
    return {
      id: userId,
      pais: u?.pais ?? "VE",
      nombre: u?.nombre ?? null,
      cedula: u?.cedula ?? null,
      telefono: u?.telefono ?? null,
      identidadCompleta: identidadCompleta(u),
    };
  }

  // Completar perfil (Google): mismo portón de cédula que el registro.
  async onboard(userId: string, dto: OnboardDto) {
    // la cédula puede estar tomada por otra cuenta (cedula @unique)
    const dueño = await prisma.usuario.findUnique({ where: { cedula: dto.cedula } });
    if (dueño && dueño.id !== userId)
      throw new ConflictException("Ese documento ya está registrado en otra cuenta");
    // Portón: documento real + nombre oficial (fail-open si la API no responde).
    const v = await this.cedula.validarParaRegistro(dto.pais, dto.cedula, dto.nombre);
    return prisma.usuario.update({
      where: { id: userId },
      data: {
        pais: dto.pais,
        nombre: v.nombre,
        cedula: dto.cedula,
        telefono: dto.telefono,
        cedulaVerificada: v.cedulaVerificada,
        cedulaNombre: v.cedulaNombre,
        cedulaVerificadaEn: v.cedulaVerificada ? new Date() : null,
      },
    });
  }

  // Invitación = JWT corto ligado a un centro (spec §4). El front arma la URL absoluta.
  invite(centroId: string) {
    const token = this.jwt.sign(
      { centroId, typ: "invite" },
      { expiresIn: INVITACION.expiresIn },
    );
    return { token, expiresInMin: INVITACION.ttlMin };
  }

  // Canje del token: une al device como VOLUNTARIO (idempotente, no degrada al JEFE).
  async accept(userId: string, token: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException("Invitación inválida o expirada");
    }
    if (payload?.typ !== "invite" || !payload?.centroId)
      throw new UnauthorizedException("Token no es una invitación");
    const centroId: string = payload.centroId;
    await prisma.voluntario.upsert({
      where: { usuarioId_centroId: { usuarioId: userId, centroId } },
      update: {}, // re-aceptar no toca el rol existente
      create: { usuarioId: userId, centroId },
    });
    const centro = await prisma.centro.findUnique({
      where: { id: centroId },
      select: { nombre: true },
    });
    return { centroId, nombre: centro?.nombre ?? null };
  }
}

@Controller()
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  // Current user identity. JWT required; any authenticated user can access.
  @Get("usuarios/me")
  @UseGuards(SesionGuard)
  me(@Req() req: any) {
    return this.service.me(userIdOf(req));
  }

  @Post("usuarios/onboard")
  @UseGuards(SesionGuard)
  onboard(@Req() req: any, @Body() dto: OnboardDto) {
    return this.service.onboard(userIdOf(req), dto);
  }

  // Solo el JEFE del centro puede mintear invitaciones (con rate-limit anti-abuso).
  @Post("invitaciones")
  @UseGuards(RateLimitGuard, JefeGuard)
  invite(@Body() dto: InviteDto) {
    return this.service.invite(dto.centroId);
  }

  // Unirse: requiere identidad completa (rate-limit anti-abuso de canje).
  @Post("invitaciones/aceptar")
  @UseGuards(RateLimitGuard, IdentidadGuard)
  accept(@Req() req: any, @Body() dto: AceptarInvitacionDto) {
    return this.service.accept(userIdOf(req), dto.token);
  }
}
