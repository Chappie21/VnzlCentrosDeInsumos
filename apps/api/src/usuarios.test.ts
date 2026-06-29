import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

// Mock del cliente compartido: evita Postgres y deja espiar las queries.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    voluntario: { upsert: vi.fn() },
    centro: { findUnique: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
}));

import { UsuariosService } from "./usuarios";
import { INVITACION } from "./constants";

// JwtService falso: sign/verify espiables.
const jwt = {
  sign: vi.fn(() => "tok-123"),
  verify: vi.fn(),
} as any;

// CedulaService solo se usa en onboard (no en invite/accept); mock mínimo.
const cedula = { validarParaRegistro: vi.fn() } as any;

const service = new UsuariosService(jwt, cedula);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsuariosService.invite", () => {
  it("firma { centroId, typ:'invite' } con expiresIn 1h y devuelve expiresInMin 60", () => {
    const res = service.invite("c1");

    expect(jwt.sign).toHaveBeenCalledWith({ centroId: "c1", typ: "invite" }, { expiresIn: "1h" });
    expect(res).toEqual({ token: "tok-123", expiresInMin: 60 });
    expect(INVITACION.ttlMin).toBe(60);
  });
});

describe("UsuariosService.accept", () => {
  it("token válido: upsert VOLUNTARIO por default y devuelve { centroId, nombre }", async () => {
    jwt.verify.mockReturnValue({ centroId: "c1", typ: "invite" });
    prismaMock.voluntario.upsert.mockResolvedValue({});
    prismaMock.centro.findUnique.mockResolvedValue({ nombre: "Centro Uno" });

    const res = await service.accept("fp-1", "tok-123");

    expect(prismaMock.voluntario.upsert).toHaveBeenCalledWith({
      where: { usuarioId_centroId: { usuarioId: "fp-1", centroId: "c1" } },
      update: {},
      create: { usuarioId: "fp-1", centroId: "c1" }, // rol cae al default VOLUNTARIO
    });
    expect(prismaMock.centro.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { nombre: true },
    });
    expect(res).toEqual({ centroId: "c1", nombre: "Centro Uno" });
  });

  it("token inválido/expirado: jwt.verify lanza → UnauthorizedException", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await expect(service.accept("fp-1", "malo")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaMock.voluntario.upsert).not.toHaveBeenCalled();
  });

  it("token sin typ:invite → UnauthorizedException", async () => {
    jwt.verify.mockReturnValue({ centroId: "c1", typ: "user" });

    await expect(service.accept("fp-1", "tok-user")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaMock.voluntario.upsert).not.toHaveBeenCalled();
  });

  it("JEFE re-acepta: update es {} → no se sobreescribe el rol", async () => {
    jwt.verify.mockReturnValue({ centroId: "c1", typ: "invite" });
    prismaMock.voluntario.upsert.mockResolvedValue({});
    prismaMock.centro.findUnique.mockResolvedValue({ nombre: "Centro Uno" });

    await service.accept("jefe-fp", "tok-123");

    const arg = prismaMock.voluntario.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({});
    expect(Object.keys(arg.update)).toHaveLength(0);
  });
});
