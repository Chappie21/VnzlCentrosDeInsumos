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
import { verifyUserToken } from "./auth/jwt-session";

// Extract Bearer token from Authorization header.
function bearer(req: any): string {
  const auth: string = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new UnauthorizedException("Sesión requerida");
  return token;
}

// Retrieve the userId that a guard placed on the request.
export function userIdOf(req: any): string {
  if (!req.userId) throw new UnauthorizedException("Sesión requerida");
  return req.userId;
}

// Identity is "complete" once name + cedula + phone are all present (spec §3).
export const identidadCompleta = (u: any) =>
  Boolean(u?.nombre && u?.cedula && u?.telefono);

// Allow any authenticated user (complete or incomplete profile). Used by onboard/me.
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    return true;
  }
}

// Gate contribution endpoints behind a complete identity.
@Injectable()
export class IdentidadGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const u = await prisma.usuario.findUnique({ where: { id: req.userId } });
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
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const paramId = req.params?.centroId;
    const bodyId = req.body?.centroId;
    if (paramId && bodyId && paramId !== bodyId) {
      throw new BadRequestException("Ambigüedad de centroId");
    }
    const centroId = paramId ?? bodyId;
    if (!centroId) throw new BadRequestException("centroId requerido");
    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: req.userId, centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");
    return true;
  }
}

// Solo el JEFE (dueño) del centro puede editar los datos principales (nombre,
// ubicación). Espeja VoluntarioGuard pero exige rol === JEFE.
@Injectable()
export class JefeGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const paramId = req.params?.centroId;
    const bodyId = req.body?.centroId;
    if (paramId && bodyId && paramId !== bodyId) {
      throw new BadRequestException("Ambigüedad de centroId");
    }
    const centroId = paramId ?? bodyId;
    if (!centroId) throw new BadRequestException("centroId requerido");
    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: req.userId, centroId } },
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
