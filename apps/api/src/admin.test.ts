import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { admin: { findUnique: vi.fn() } },
}));
vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
}));

const compareMock = vi.hoisted(() => vi.fn());
vi.mock("bcryptjs", () => ({ compare: compareMock }));

import { AdminService } from "./admin";

const jwt = { signAsync: vi.fn(async () => "jwt-token") } as any;
const service = new AdminService(jwt);

beforeEach(() => vi.clearAllMocks());

describe("AdminService.login", () => {
  it("rechaza si el admin no existe", async () => {
    prismaMock.admin.findUnique.mockResolvedValue(null);
    await expect(service.login("x@y.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza si la contraseña no coincide", async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: "a1", activo: true, passwordHash: "h", nombre: "V" });
    compareMock.mockResolvedValue(false);
    await expect(service.login("x@y.com", "bad")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza si el admin está inactivo", async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: "a1", activo: false, passwordHash: "h", nombre: "V" });
    compareMock.mockResolvedValue(true);
    await expect(service.login("x@y.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("con credenciales válidas devuelve token + nombre y normaliza el email", async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: "a1", activo: true, passwordHash: "h", nombre: "Victor" });
    compareMock.mockResolvedValue(true);
    const res = await service.login(" X@Y.com ", "pw");
    expect(res).toEqual({ token: "jwt-token", nombre: "Victor" });
    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith({ where: { email: "x@y.com" } });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "a1", typ: "admin" }, { expiresIn: "8h" });
  });
});
