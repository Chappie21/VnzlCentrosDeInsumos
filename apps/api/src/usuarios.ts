import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsNotEmpty, IsString, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { prisma } from "@vnzl/database";
import {
  IdentidadGuard,
  JefeGuard,
  RateLimitGuard,
  fingerprintOf,
  identidadCompleta,
} from "./guards";
import { INVITACION } from "./constants";

class OnboardDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  nombre: string;

  // Normalize: uppercase, strip dots/spaces/dashes; bare digits -> prefix V.
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    let v = value.toUpperCase().replace(/[.\s-]/g, "");
    if (/^\d+$/.test(v)) v = "V" + v;
    return v;
  })
  @Matches(/^[VE]\d{6,9}$/, { message: "Cédula inválida (ej: V12345678)" })
  cedula: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
  )
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

  // Public profile of the current device (spec §3). Anonymous observers get nulls, never 404.
  async me(fingerprint: string) {
    const u = await prisma.usuario.findUnique({ where: { fingerprint } });
    return {
      fingerprint,
      nombre: u?.nombre ?? null,
      cedula: u?.cedula ?? null,
      telefono: u?.telefono ?? null,
      identidadCompleta: identidadCompleta(u),
    };
  }

  // Onboarding (spec §3): name/cedula/phone required before contributing.
  onboard(fingerprint: string, dto: OnboardDto) {
    return prisma.usuario.upsert({
      where: { fingerprint },
      update: dto,
      create: { fingerprint, ...dto },
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

  // Public: current device identity. No guard, just the fingerprint header.
  @Get("usuarios/me")
  me(@Req() req: any) {
    return this.service.me(fingerprintOf(req));
  }

  @Post("usuarios/onboard")
  onboard(@Req() req: any, @Body() dto: OnboardDto) {
    return this.service.onboard(fingerprintOf(req), dto);
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
    return this.service.accept(fingerprintOf(req), dto.token);
  }
}
