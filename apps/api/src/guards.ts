import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@vnzl/database";
import { RedisService } from "./redis.service";

// Identity = device fingerprint. Bootstrap endpoints (onboard, me) read it from
// the x-fingerprint header; protected endpoints get it from a verified JWT
// (AuthGuard sets req.fingerprintFromToken).
export function fingerprintOf(req: any): string {
  const fp = req.fingerprintFromToken ?? req.header("x-fingerprint");
  if (!fp) throw new BadRequestException("Falta x-fingerprint o token");
  return fp;
}

// Verifies the user JWT (Authorization: Bearer) and exposes its fingerprint.
// Token is issued at onboard / me once the identity is complete.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.header("authorization") || "").split(" ");
    if (scheme !== "Bearer" || !token)
      throw new UnauthorizedException("Token requerido");
    try {
      const payload = this.jwt.verify(token);
      if (!payload?.sub) throw new Error("sin sub");
      req.fingerprintFromToken = payload.sub;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
    return true;
  }
}

// Identity is "complete" once name + cedula + phone are all present (spec §3).
export const identidadCompleta = (u: any) =>
  Boolean(u?.nombre && u?.cedula && u?.telefono);

// Gate contribution endpoints behind a complete identity.
@Injectable()
export class IdentidadGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const fingerprint = fingerprintOf(req);
    const u = await prisma.usuario.findUnique({ where: { fingerprint } });
    if (!identidadCompleta(u))
      throw new ForbiddenException(
        "Completa tu identidad para realizar esta acción",
      );
    return true;
  }
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
    const fp = req.fingerprintFromToken || req.header("x-fingerprint") || req.ip;
    const key = `rl:${req.route?.path ?? req.path}:${fp}`;
    if (!(await this.redis.hit(key, 10, 60)))
      throw new HttpException(
        "Demasiadas solicitudes, espera un minuto",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
