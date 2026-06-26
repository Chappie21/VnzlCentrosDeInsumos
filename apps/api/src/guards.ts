import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { prisma } from "@vnzl/database";
import { RedisService } from "./redis.service";

// Identity = device fingerprint, sent as header. No login (spec §3).
export function fingerprintOf(req: any): string {
  const fp = req.header("x-fingerprint");
  if (!fp) throw new BadRequestException("x-fingerprint header requerido");
  return fp;
}

// Only volunteers of the target centro may scan/approve donations (spec §6.4).
@Injectable()
export class VoluntarioGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const fingerprint = fingerprintOf(req);
    const centroId = req.body?.centroId ?? req.params?.centroId;
    if (!centroId) throw new BadRequestException("centroId requerido");

    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: fingerprint, centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");
    return true;
  }
}

// Redis-backed rate limit for create-heavy endpoints (spec §6.5).
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}
  // ponytail: hard-coded 10/min. pull into config only when limits need to differ per route.
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const fp = req.header("x-fingerprint") || req.ip;
    const key = `rl:${req.route?.path ?? req.path}:${fp}`;
    if (!(await this.redis.hit(key, 10, 60)))
      throw new HttpException(
        "Demasiadas solicitudes, espera un minuto",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
