import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { voluntario: { findUnique: vi.fn() } },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
}));

import { JefeGuard } from "./guards";

const jwt = new JwtService({ secret: "test-secret" });
const USER_ID = "user-1";
let validToken: string;

beforeAll(async () => {
  validToken = await jwt.signAsync({ sub: USER_ID, typ: "user" });
});

// ExecutionContext mínimo: solo necesitamos getRequest().
const ctxDe = (req: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

const reqDe = () => ({
  header: (h: string) => h.toLowerCase() === "authorization" ? `Bearer ${validToken}` : undefined,
  params: { centroId: "c1" },
  body: {},
});

let guard: JefeGuard;

beforeEach(() => {
  vi.clearAllMocks();
  guard = new JefeGuard(jwt);
});

describe("JefeGuard", () => {
  it("permite al JEFE del centro", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "JEFE" });
    await expect(guard.canActivate(ctxDe(reqDe()))).resolves.toBe(true);
    expect(prismaMock.voluntario.findUnique).toHaveBeenCalledWith({
      where: { usuarioId_centroId: { usuarioId: USER_ID, centroId: "c1" } },
    });
  });

  it("rechaza a un VOLUNTARIO (Forbidden)", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "VOLUNTARIO" });
    await expect(guard.canActivate(ctxDe(reqDe()))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a quien no es voluntario (Forbidden)", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(ctxDe(reqDe()))).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Regresión IDOR (PR #78): un centroId en el body distinto al de la URL es
  // ambigüedad → BadRequest, nunca se autoriza el centro del body.
  it("rechaza ambigüedad param≠body (anti-IDOR)", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "JEFE" });
    const req = { ...reqDe(), body: { centroId: "c2" } }; // param es "c1"
    await expect(guard.canActivate(ctxDe(req))).rejects.toBeInstanceOf(BadRequestException);
  });
});
