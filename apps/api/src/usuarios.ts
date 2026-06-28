import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsNotEmpty, IsString, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { prisma } from "@vnzl/database";
import {
  IdentidadGuard,
  JefeGuard,
  RateLimitGuard,
  SesionGuard,
  userIdOf,
  identidadCompleta,
} from "./guards";
import { INVITACION } from "./constants";

// ---------------------------------------------------------------------------
// Normalizers (exported so AuthService can reuse them — DRY).
// ---------------------------------------------------------------------------

/** Uppercase, strip dots/spaces/dashes; bare digit string → prefix V. */
export function normalizarCedula(value: string): string {
  let v = value.toUpperCase().replace(/[.\s-]/g, "");
  if (/^\d+$/.test(v)) v = "V" + v;
  return v;
}

/** Strip spaces and dashes from a phone number string. */
export function normalizarTelefono(value: string): string {
  return value.replace(/[\s-]/g, "");
}

class OnboardDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  nombre: string;

  // Normalize: uppercase, strip dots/spaces/dashes; bare digits -> prefix V.
  @Transform(({ value }) => (typeof value === "string" ? normalizarCedula(value) : value))
  @Matches(/^[VE]\d{6,9}$/, { message: "Cédula inválida (ej: V12345678)" })
  cedula: string;

  @Transform(({ value }) => (typeof value === "string" ? normalizarTelefono(value) : value))
  @Matches(/^(?:\+?58|0)?4(?:12|14|16|24|26)\d{7}$/, {
    message: "Teléfono móvil venezolano inválido",
  })
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
  constructor(private readonly jwt: JwtService) {}

  // Public profile of the current user (spec §3). Returns nulls for incomplete identity.
  async me(userId: string) {
    const u = await prisma.usuario.findUnique({ where: { id: userId } });
    return {
      id: userId,
      nombre: u?.nombre ?? null,
      cedula: u?.cedula ?? null,
      telefono: u?.telefono ?? null,
      identidadCompleta: identidadCompleta(u),
    };
  }

  // Onboarding (spec §3): name/cedula/phone required before contributing.
  onboard(userId: string, dto: OnboardDto) {
    // el JWT de sesión solo se emite tras crear el Usuario, así que la fila siempre existe
    return prisma.usuario.update({
      where: { id: userId },
      data: dto,
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
