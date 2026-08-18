import { describe, it, expect, vi, beforeEach } from "vitest";

// tx: el cliente dentro de $transaction. prismaMock.$transaction ejecuta el callback con él.
const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    insumo: { findMany: vi.fn(), createManyAndReturn: vi.fn(), updateMany: vi.fn() },
    historial: { createMany: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      $transaction: vi.fn(),
      insumo: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      historial: { create: vi.fn() },
    },
  };
});

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: {
    AGUA: "AGUA",
    MEDICAMENTOS: "MEDICAMENTOS",
    ROPA: "ROPA",
    ALIMENTOS: "ALIMENTOS",
    HERRAMIENTAS: "HERRAMIENTAS",
  },
  TipoMovimiento: { DONACION: "DONACION", CARGA_INICIAL: "CARGA_INICIAL", AJUSTE: "AJUSTE", SALIDA: "SALIDA" },
}));

import { HistorialService, HistorialController } from "./historial";

const redis = { bumpCentros: vi.fn() } as any;
const service = new HistorialService(redis);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
  // recalcularNiveles() corre tras cada movimiento; sin filas no recalcula nada.
  prismaMock.insumo.findMany.mockResolvedValue([]);
});

describe("HistorialService.recibir — donación por nombre", () => {
  it("crea el insumo si no existe, con su Historial por el mismo monto", async () => {
    tx.insumo.findMany.mockResolvedValue([]);
    tx.insumo.createManyAndReturn.mockResolvedValue([{ id: "new1", nombre: "Agua embotellada" }]);

    const res = await service.recibir("vol-1", {
      centroId: "c1",
      items: [{ nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 }],
    });

    // El insumo nace con su cantidad; la regla de oro se sostiene porque el
    // Historial del MISMO monto se crea en la misma tx (y no hay increment extra).
    expect(tx.insumo.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            centroId: "c1",
            nombre: "Agua embotellada",
            categoria: "AGUA",
            cantidadTotal: 5,
          }),
        ],
      }),
    );
    expect(tx.historial.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ insumoId: "new1", usuarioId: "vol-1", cantidad: 5 })],
    });
    expect(tx.insumo.updateMany).not.toHaveBeenCalled(); // ya nació con el stock
    expect(redis.bumpCentros).toHaveBeenCalled();
    expect(res).toEqual({ ok: true, recibidos: 1 });
  });

  it("usa el insumo existente (no lo crea) e incrementa", async () => {
    tx.insumo.findMany.mockResolvedValue([{ id: "exist1", nombre: "Agua" }]);

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [{ nombre: "Agua", cantidad: 3 }],
    });

    expect(tx.insumo.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.historial.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ insumoId: "exist1", cantidad: 3 })],
    });
    expect(tx.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["exist1"] } },
      data: { cantidadTotal: { increment: 3 } },
    });
  });

  it("matchea el nombre case-insensitive en un único lookup por lote", async () => {
    tx.insumo.findMany.mockResolvedValue([{ id: "exist1", nombre: "AGUA" }]);

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [{ nombre: "agua", cantidad: 4 }],
    });

    expect(tx.insumo.findMany).toHaveBeenCalledTimes(1);
    expect(tx.insumo.findMany.mock.calls[0][0].where).toEqual({
      centroId: "c1",
      OR: [{ nombre: { equals: "agua", mode: "insensitive" } }],
    });
    expect(tx.insumo.createManyAndReturn).not.toHaveBeenCalled(); // "AGUA" ya existe
    expect(tx.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["exist1"] } },
      data: { cantidadTotal: { increment: 4 } },
    });
  });

  it("agrupa items con el mismo nombre (case-insensitive) sumando cantidades", async () => {
    tx.insumo.findMany.mockResolvedValue([{ id: "exist1", nombre: "Agua" }]);

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [
        { nombre: "Agua", cantidad: 2 },
        { nombre: "agua", cantidad: 3 },
      ],
    });

    // un único nombre -> un único movimiento de 5, no dos de 2 y 3
    expect(tx.insumo.findMany.mock.calls[0][0].where.OR).toHaveLength(1);
    expect(tx.historial.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ insumoId: "exist1", cantidad: 5 })],
    });
    expect(tx.insumo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cantidadTotal: { increment: 5 } } }),
    );
  });

  it("un solo par de queries para N items: createMany + un updateMany por monto", async () => {
    tx.insumo.findMany.mockResolvedValue([
      { id: "e1", nombre: "Agua" },
      { id: "e2", nombre: "Mantas" },
      { id: "e3", nombre: "Arroz" },
    ]);

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [
        { nombre: "Agua", cantidad: 2 },
        { nombre: "Mantas", cantidad: 2 },
        { nombre: "Arroz", cantidad: 7 },
      ],
    });

    expect(tx.historial.createMany).toHaveBeenCalledTimes(1);
    expect(tx.historial.createMany.mock.calls[0][0].data).toHaveLength(3);
    // 2 montos distintos -> 2 updateMany, no 3 updates
    expect(tx.insumo.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1", "e2"] } },
      data: { cantidadTotal: { increment: 2 } },
    });
  });
});

describe("HistorialService.ajuste — corrección manual (JEFE)", () => {
  beforeEach(() => {
    // forma array de $transaction (ajuste usa moveOps(prisma, ...))
    prismaMock.$transaction.mockImplementation(async (ops: any) => Promise.all(ops));
  });

  it("aplica el ajuste como Historial tipo AJUSTE y mueve cantidadTotal", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1", cantidadTotal: 5 });

    await service.ajuste("jefe-1", { centroId: "c1", insumoId: "i1", cantidad: 3 });

    expect(prismaMock.historial.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ insumoId: "i1", cantidad: 3, tipo: "AJUSTE" }) }),
    );
    expect(prismaMock.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "i1" }, data: { cantidadTotal: { increment: 3 } } }),
    );
    expect(redis.bumpCentros).toHaveBeenCalled();
  });

  it("rechaza un ajuste que dejaría el stock negativo", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1", cantidadTotal: 2 });
    await expect(
      service.ajuste("jefe-1", { centroId: "c1", insumoId: "i1", cantidad: -5 }),
    ).rejects.toThrow(/negativo/i);
    expect(prismaMock.historial.create).not.toHaveBeenCalled();
  });

  it("rechaza cantidad 0", async () => {
    await expect(
      service.ajuste("jefe-1", { centroId: "c1", insumoId: "i1", cantidad: 0 }),
    ).rejects.toThrow(/0/);
  });

  it("rechaza si el insumo es de otro centro", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "otro", cantidadTotal: 5 });
    await expect(
      service.ajuste("jefe-1", { centroId: "c1", insumoId: "i1", cantidad: 1 }),
    ).rejects.toThrow(/no pertenece/i);
    expect(prismaMock.historial.create).not.toHaveBeenCalled();
  });
});

describe("HistorialService.addOne — movimiento simple", () => {
  it("aplica el movimiento si el insumo pertenece al centro", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1" });
    prismaMock.$transaction.mockResolvedValue(["hist"]);
    const res = await service.addOne("vol-1", { centroId: "c1", insumoId: "i1", cantidad: 5 });
    expect(res).toBe("hist");
    expect(prismaMock.insumo.findUnique).toHaveBeenCalledWith({
      where: { id: "i1" },
      select: { centroId: true },
    });
  });

  it("rechaza si el insumo es de otro centro", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c2" });
    await expect(
      service.addOne("vol-1", { centroId: "c1", insumoId: "i1", cantidad: 5 })
    ).rejects.toThrow(/no pertenece al centro/i);
  });
});

describe("HistorialService — recálculo de nivel por evento", () => {
  it("tras mover stock, recalcula el nivel del insumo con umbrales", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1" });
    prismaMock.$transaction.mockResolvedValue(["hist"]);
    // El stock ya cruzó el umbral suficiente (12 >= 10) y el nivel viejo era URGENTE.
    prismaMock.insumo.findMany.mockResolvedValue([
      { id: "i1", cantidadTotal: 12, nivel: "URGENTE", umbralUrgente: 3, umbralSuficiente: 10 },
    ]);

    await service.addOne("vol-1", { centroId: "c1", insumoId: "i1", cantidad: 7 });

    // agrupado por nivel destino: un updateMany por nivel, no uno por insumo
    expect(prismaMock.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["i1"] } },
      data: { nivel: "SUFICIENTE" },
    });
  });

  it("no recalcula si el insumo no tiene umbrales (nivel manual)", async () => {
    prismaMock.insumo.findUnique.mockResolvedValue({ centroId: "c1" });
    prismaMock.$transaction.mockResolvedValue(["hist"]);
    prismaMock.insumo.findMany.mockResolvedValue([
      { id: "i1", cantidadTotal: 12, nivel: "URGENTE", umbralUrgente: null, umbralSuficiente: null },
    ]);

    await service.addOne("vol-1", { centroId: "c1", insumoId: "i1", cantidad: 7 });

    // El increment de moveOps sí ocurre; lo que NO debe ocurrir es un update de
    // `nivel` (recalcularNiveles es el único que usa updateMany acá).
    expect(prismaMock.insumo.updateMany).not.toHaveBeenCalled();
  });
});

describe("HistorialController.recibir", () => {
  it("usa el userId del request y delega al service", () => {
    const svc = { recibir: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new HistorialController(svc);
    const req = { userId: "fp-1" };
    const dto = { centroId: "c1", items: [{ nombre: "Agua", cantidad: 1 }] };

    expect(ctrl.recibir(req as any, dto as any)).toBe("ok");
    expect(svc.recibir).toHaveBeenCalledWith("fp-1", dto);
  });
});
