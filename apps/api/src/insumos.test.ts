import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationPipe, ForbiddenException } from "@nestjs/common";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    insumo: { findUnique: vi.fn(), update: vi.fn() },
    voluntario: { findUnique: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
}));

import { InsumosService, UpdateInsumoDto } from "./insumos";

const redis = { bumpCentros: vi.fn() } as any;
const service = new InsumosService(redis);

beforeEach(() => vi.clearAllMocks());

describe("InsumosService.actualizar", () => {
  it("verifica membresía, actualiza nivel y bumpea (nivel cambió)", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1", nivel: "NORMAL" });
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "VOLUNTARIO" });
    prismaMock.insumo.update.mockResolvedValue({ id: "i1", nivel: "URGENTE" });

    const res = await service.actualizar("fp-1", "i1", { nivel: "URGENTE" } as any);

    expect(prismaMock.voluntario.findUnique).toHaveBeenCalledWith({
      where: { usuarioId_centroId: { usuarioId: "fp-1", centroId: "c1" } },
    });
    expect(prismaMock.insumo.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { nivel: "URGENTE" },
    });
    expect(redis.bumpCentros).toHaveBeenCalledTimes(1);
    expect(res.nivel).toBe("URGENTE");
  });

  it("no bumpea si el nivel no cambia (solo edita nombre)", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1", nivel: "NORMAL" });
    prismaMock.voluntario.findUnique.mockResolvedValue({ rol: "JEFE" });
    prismaMock.insumo.update.mockResolvedValue({ id: "i1" });

    await service.actualizar("fp-1", "i1", { nombre: "Agua potable" } as any);

    expect(redis.bumpCentros).not.toHaveBeenCalled();
  });

  it("rechaza a quien no es voluntario del centro (Forbidden)", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1", nivel: "NORMAL" });
    prismaMock.voluntario.findUnique.mockResolvedValue(null);

    await expect(service.actualizar("fp-x", "i1", {} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.insumo.update).not.toHaveBeenCalled();
  });
});

describe("UpdateInsumoDto — whitelist protege cantidadTotal", () => {
  // El ValidationPipe global (whitelist:true) descarta props no declaradas.
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = { type: "body", metatype: UpdateInsumoDto } as any;

  it("acepta nivel válido y descarta cantidadTotal", async () => {
    const out = await pipe.transform({ nivel: "URGENTE", cantidadTotal: 999 }, meta);
    expect(out.nivel).toBe("URGENTE");
    expect(out).not.toHaveProperty("cantidadTotal"); // regla de oro
  });

  it("rechaza un nivel fuera del enum", async () => {
    await expect(pipe.transform({ nivel: "MUCHISIMO" }, meta)).rejects.toBeTruthy();
  });
});
