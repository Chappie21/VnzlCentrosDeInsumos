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
  VoluntarioGuard,
  fingerprintOf,
  identidadCompleta,
} from "./guards";

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

  // Volunteer invite link/QR = short-lived JWT bound to a centro (spec §4.3).
  invite(centroId: string) {
    const token = this.jwt.sign({ centroId }, { expiresIn: "24h" });
    return { token, url: `/invite/${token}` };
  }

  async accept(fingerprint: string, token: string) {
    let centroId: string;
    try {
      centroId = this.jwt.verify(token).centroId;
    } catch {
      throw new UnauthorizedException("Invitación inválida o expirada");
    }
    return prisma.voluntario.upsert({
      where: { usuarioId_centroId: { usuarioId: fingerprint, centroId } },
      update: {},
      create: { usuarioId: fingerprint, centroId },
    });
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

  // Only an existing volunteer of the centro can mint invites.
  @Post("invitaciones")
  @UseGuards(VoluntarioGuard)
  invite(@Body() body: { centroId: string }) {
    return this.service.invite(body.centroId);
  }

  @Post("invitaciones/aceptar")
  @UseGuards(IdentidadGuard)
  accept(@Req() req: any, @Body() body: { token: string }) {
    return this.service.accept(fingerprintOf(req), body.token);
  }
}
