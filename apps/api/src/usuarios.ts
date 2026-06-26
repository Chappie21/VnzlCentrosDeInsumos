import {
  Body,
  Controller,
  Injectable,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsString } from "class-validator";
import { prisma } from "@vnzl/database";
import { VoluntarioGuard, fingerprintOf } from "./guards";

class OnboardDto {
  @IsString() nombre: string;
  @IsString() cedula: string;
  @IsString() telefono: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly jwt: JwtService) {}

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
    const user = await prisma.usuario.findUnique({ where: { fingerprint } });
    if (!user?.nombre || !user?.cedula || !user?.telefono)
      throw new UnauthorizedException("Completa tu identidad antes de unirte");
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
  accept(@Req() req: any, @Body() body: { token: string }) {
    return this.service.accept(fingerprintOf(req), body.token);
  }
}
