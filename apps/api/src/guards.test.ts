import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException } from "@nestjs/common";

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

// ExecutionContext mínimo: solo necesitamos getRequest().
const ctxDe = (req: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

const reqDe = (rol?: string) => ({
  header: (h: string) => (h === "x-fingerprint" ? "fp-1" : undefined),
  params: { centroId: "c1" },
  body: {},
});

const guard = new JefeGuard();

beforeEach(() => vi.clearAllMocks());

describe("JefeGuard", () => {
  it("permite al JEFE del centro", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "JEFE" });
    await expect(guard.canActivate(ctxDe(reqDe()))).resolves.toBe(true);
    expect(prismaMock.voluntario.findUnique).toHaveBeenCalledWith({
      where: { usuarioId_centroId: { usuarioId: "fp-1", centroId: "c1" } },
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
});
