import { describe, it, expect, vi } from "vitest";
import { UnauthorizedException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SesionGuard, VoluntarioGuard, OptionalSesionGuard } from "./guards";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    voluntario: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
  NivelInsumo: {},
  CategoriaInsumo: {},
}));

const jwt = new JwtService({ secret: "test-secret" });
function ctx(headers: Record<string, string>, body: any = {}, params: any = {}) {
  const req: any = { headers, body, params, header: (h: string) => headers[h.toLowerCase()] };
  return { switchToHttp: () => ({ getRequest: () => req }), _req: req } as any;
}

it("SesionGuard rechaza sin Bearer", async () => {
  const g = new SesionGuard(jwt);
  await expect(g.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
});

it("SesionGuard permite con token válido y pone userId en req", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "user-z", typ: "user" });
  const context = ctx({ authorization: `Bearer ${token}` });
  const g = new SesionGuard(jwt);
  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBe("user-z");
});

it("OptionalSesionGuard sin token: pasa con userId=null", async () => {
  const g = new OptionalSesionGuard(jwt);
  const context = ctx({});
  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBeNull();
});

it("OptionalSesionGuard con token válido: pasa y setea userId", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "user-y", typ: "user" });
  const g = new OptionalSesionGuard(jwt);
  const context = ctx({ authorization: `Bearer ${token}` });
  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBe("user-y");
});

it("OptionalSesionGuard con token inválido: pasa con userId=null (no lanza)", async () => {
  const g = new OptionalSesionGuard(jwt);
  const context = ctx({ authorization: "Bearer basura" });
  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBeNull();
});

it("VoluntarioGuard rechaza sin Bearer", async () => {
  const g = new VoluntarioGuard(jwt);
  await expect(g.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
});

it("VoluntarioGuard permite al voluntario del centro (positive path)", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "user-x", typ: "user" });
  prismaMock.voluntario.findUnique.mockResolvedValue({ usuarioId: "user-x", centroId: "c1" });

  const context = ctx({ authorization: `Bearer ${token}` }, { centroId: "c1" });
  const g = new VoluntarioGuard(jwt);

  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBe("user-x");
});

// Regresión IDOR (PR #78): en el código viejo `body?.centroId ?? params?.centroId`
// un atacante voluntario de "mine" podía golpear la ruta /centros/victim/... con
// body {centroId:"mine"} → guard autorizaba "mine" mientras el controller actuaba
// sobre "victim". Ahora param≠body es ambigüedad → BadRequest.
it("VoluntarioGuard rechaza ambigüedad param≠body (anti-IDOR)", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "atk", typ: "user" });
  // El atacante SÍ es voluntario del centro que pone en el body ("mine").
  prismaMock.voluntario.findUnique.mockResolvedValue({ usuarioId: "atk", centroId: "mine" });

  const context = ctx({ authorization: `Bearer ${token}` }, { centroId: "mine" }, { centroId: "victim" });
  const g = new VoluntarioGuard(jwt);

  await expect(g.canActivate(context)).rejects.toBeInstanceOf(BadRequestException);
});

it("VoluntarioGuard valida el centro del param cuando param y body coinciden", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "user-x", typ: "user" });
  prismaMock.voluntario.findUnique.mockResolvedValue({ usuarioId: "user-x", centroId: "c1" });

  const context = ctx({ authorization: `Bearer ${token}` }, { centroId: "c1" }, { centroId: "c1" });
  const g = new VoluntarioGuard(jwt);

  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(prismaMock.voluntario.findUnique).toHaveBeenCalledWith({
    where: { usuarioId_centroId: { usuarioId: "user-x", centroId: "c1" } },
  });
});

it("VoluntarioGuard usa el param (no el body ausente) en rutas con :centroId", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "atk", typ: "user" });
  prismaMock.voluntario.findUnique.mockResolvedValue(null); // no es voluntario de "victim"

  const context = ctx({ authorization: `Bearer ${token}` }, {}, { centroId: "victim" });
  const g = new VoluntarioGuard(jwt);

  await expect(g.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  expect(prismaMock.voluntario.findUnique).toHaveBeenCalledWith({
    where: { usuarioId_centroId: { usuarioId: "atk", centroId: "victim" } },
  });
});
