import { describe, it, expect, vi, beforeEach } from "vitest";

// tx: el cliente dentro de $transaction. prismaMock.$transaction ejecuta el callback con él.
const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    insumo: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    historial: { create: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      $transaction: vi.fn(),
      insumo: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
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
  it("crea el insumo si no existe e incrementa cantidadTotal vía Historial", async () => {
    tx.insumo.findFirst.mockResolvedValue(null);
    tx.insumo.create.mockResolvedValue({ id: "new1" });

    const res = await service.recibir("vol-1", {
      centroId: "c1",
      items: [{ nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 }],
    });

    expect(tx.insumo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          centroId: "c1",
          nombre: "Agua embotellada",
          categoria: "AGUA",
          cantidadTotal: 0,
        }),
      }),
    );
    expect(tx.historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ insumoId: "new1", usuarioId: "vol-1", cantidad: 5 }),
      }),
    );
    expect(tx.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "new1" }, data: { cantidadTotal: { increment: 5 } } }),
    );
    expect(redis.bumpCentros).toHaveBeenCalled();
    expect(res).toEqual({ ok: true, recibidos: 1 });
  });

  it("usa el insumo existente (no lo crea) e incrementa", async () => {
    tx.insumo.findFirst.mockResolvedValue({ id: "exist1" });

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [{ nombre: "Agua", cantidad: 3 }],
    });

    expect(tx.insumo.create).not.toHaveBeenCalled();
    expect(tx.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "exist1" }, data: { cantidadTotal: { increment: 3 } } }),
    );
  });

  it("agrupa items con el mismo nombre (case-insensitive) sumando cantidades", async () => {
    tx.insumo.findFirst.mockResolvedValue({ id: "exist1" });

    await service.recibir("vol-1", {
      centroId: "c1",
      items: [
        { nombre: "Agua", cantidad: 2 },
        { nombre: "agua", cantidad: 3 },
      ],
    });

    expect(tx.insumo.findFirst).toHaveBeenCalledTimes(1); // un único nombre
    expect(tx.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cantidadTotal: { increment: 5 } } }),
    );
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

    expect(prismaMock.insumo.update).toHaveBeenCalledWith({
      where: { id: "i1" },
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

    // El increment de moveOps sí ocurre; lo que NO debe ocurrir es un update de `nivel`.
    expect(prismaMock.insumo.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nivel: expect.anything() }) }),
    );
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
