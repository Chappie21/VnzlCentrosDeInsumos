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
import { prisma, RolVoluntario } from "@vnzl/database";
import { RedisService } from "./redis.service";
import { RATE_LIMIT } from "./constants";

// Identity = device fingerprint, sent as header. No login (spec §3).
export function fingerprintOf(req: any): string {
  const fp = req.header("x-fingerprint");
  if (!fp) throw new BadRequestException("x-fingerprint header requerido");
  return fp;
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

// Solo el JEFE (dueño) del centro puede editar los datos principales (nombre,
// ubicación). Espeja VoluntarioGuard pero exige rol === JEFE.
@Injectable()
export class JefeGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const fingerprint = fingerprintOf(req);
    const centroId = req.params?.centroId ?? req.body?.centroId;
    if (!centroId) throw new BadRequestException("centroId requerido");

    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: fingerprint, centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");
    if (link.rol !== RolVoluntario.JEFE)
      throw new ForbiddenException("Solo el jefe del centro puede hacer esto");
    return true;
  }
}

// Acceso de moderación del equipo (opción C): sesión JWT por persona emitida en
// /admin/login. Verifica firma + tipo "admin" + que el admin siga activo (revocación).
// Deja `req.adminId` para registrar quién verificó (accountability).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException("Sesión de moderación requerida");

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException("Sesión inválida o expirada");
    }
    if (payload?.typ !== "admin" || !payload?.sub)
      throw new ForbiddenException("No es una sesión de moderación");

    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { activo: true },
    });
    if (!admin || !admin.activo) throw new ForbiddenException("Moderador inactivo");

    req.adminId = payload.sub;
    return true;
  }
}

// Redis-backed rate limit for create-heavy endpoints (spec §6.5).
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const fp = req.header("x-fingerprint") || req.ip;
    const key = `rl:${req.route?.path ?? req.path}:${fp}`;
    if (!(await this.redis.hit(key, RATE_LIMIT.max, RATE_LIMIT.windowSec)))
      throw new HttpException(
        "Demasiadas solicitudes, espera un minuto",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
