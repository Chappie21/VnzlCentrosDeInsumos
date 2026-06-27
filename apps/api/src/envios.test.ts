import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    envio: { create: vi.fn() },
    historial: { create: vi.fn() },
    insumo: { update: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      insumo: { findMany: vi.fn() },
      envio: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
  TipoMovimiento: { INICIAL: "INICIAL", DONACION: "DONACION", ENVIO: "ENVIO", AJUSTE: "AJUSTE" },
}));

import { EnviosService, EnviosController } from "./envios";

const redis = { bumpCentros: vi.fn() } as any;
const service = new EnviosService(redis);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
  tx.envio.create.mockResolvedValue({ id: "e1" });
});

const base = {
  centroId: "c1",
  centroDestinoId: "c2",
  transporte: "Juan Pérez",
  items: [{ insumoId: "i1", cantidad: 3 }],
};

describe("EnviosService.crear", () => {
  it("descuenta el origen (Historial negativo + decrement) y guarda quién despachó", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 10 }]);

    const res = await service.crear("vol-1", base);

    expect(tx.envio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          centroOrigenId: "c1",
          centroDestinoId: "c2",
          destinoTexto: null,
          transporte: "Juan Pérez",
          creadoPorId: "vol-1",
        }),
      }),
    );
    expect(tx.historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ insumoId: "i1", usuarioId: "vol-1", cantidad: -3, envioId: "e1", tipo: "ENVIO" }),
      }),
    );
    expect(tx.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "i1" }, data: { cantidadTotal: { decrement: 3 } } }),
    );
    expect(redis.bumpCentros).toHaveBeenCalled();
    expect(res).toEqual({ id: "e1" });
  });

  it("acepta destino de texto libre (albergue)", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 10 }]);
    await service.crear("vol-1", {
      ...base,
      centroDestinoId: undefined,
      destinoTexto: "Albergue Regional Sur",
    });
    expect(tx.envio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ centroDestinoId: null, destinoTexto: "Albergue Regional Sur" }),
      }),
    );
  });

  it("rechaza si no hay destino (ni centro ni texto)", async () => {
    await expect(
      service.crear("vol-1", { ...base, centroDestinoId: undefined, destinoTexto: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza si hay destino centro Y texto a la vez", async () => {
    await expect(
      service.crear("vol-1", { ...base, destinoTexto: "Albergue X" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza si un insumo no pertenece al centro origen", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([]); // i1 no está en el origen
    await expect(service.crear("vol-1", base)).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza si el stock es insuficiente (no descuenta nada)", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 2 }]);
    await expect(service.crear("vol-1", base)).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("agrupa items con el mismo insumo sumando cantidades", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 10 }]);
    await service.crear("vol-1", {
      ...base,
      items: [
        { insumoId: "i1", cantidad: 2 },
        { insumoId: "i1", cantidad: 3 },
      ],
    });
    expect(tx.insumo.update).toHaveBeenCalledTimes(1);
    expect(tx.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cantidadTotal: { decrement: 5 } } }),
    );
  });
});

describe("EnviosService.guia", () => {
  const envioRow = {
    id: "e1",
    transporte: "Juan",
    creadoEn: new Date("2026-06-27T12:00:00Z"),
    destinoTexto: null,
    origen: { nombre: "Centro Norte", ciudad: "Caracas", estado: "Distrito Capital" },
    destino: { nombre: "Centro Sur", ciudad: "Maracaibo", estado: "Zulia" },
    creadoPor: { nombre: "Ana" },
    movimientos: [
      { cantidad: -5, insumo: { nombre: "Agua" } },
      { cantidad: -2, insumo: { nombre: "Mantas" } },
    ],
  };

  it("arma la guía con destino centro y cantidades en positivo", async () => {
    prismaMock.envio.findUnique.mockResolvedValue(envioRow);
    const guia = await service.guia("e1");
    expect(guia.despachadoPor).toBe("Ana");
    expect(guia.destino).toEqual({ nombre: "Centro Sur", ciudad: "Maracaibo" });
    expect(guia.items).toEqual([
      { nombre: "Agua", cantidad: 5 },
      { nombre: "Mantas", cantidad: 2 },
    ]);
  });

  it("usa destinoTexto cuando no hay centro destino", async () => {
    prismaMock.envio.findUnique.mockResolvedValue({
      ...envioRow,
      destino: null,
      destinoTexto: "Albergue Regional Sur",
    });
    const guia = await service.guia("e1");
    expect(guia.destino).toEqual({ texto: "Albergue Regional Sur" });
  });

  it("404 si el envío no existe", async () => {
    prismaMock.envio.findUnique.mockResolvedValue(null);
    await expect(service.guia("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("EnviosController", () => {
  it("crear usa el fingerprint del header y delega", () => {
    const svc = { crear: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new EnviosController(svc);
    const req = { header: (h: string) => (h === "x-fingerprint" ? "fp-1" : undefined) };
    expect(ctrl.crear(req as any, base as any)).toBe("ok");
    expect(svc.crear).toHaveBeenCalledWith("fp-1", base);
  });

  it("guia delega por id (público)", () => {
    const svc = { guia: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new EnviosController(svc);
    expect(ctrl.guia("e1")).toBe("ok");
    expect(svc.guia).toHaveBeenCalledWith("e1");
  });
});
