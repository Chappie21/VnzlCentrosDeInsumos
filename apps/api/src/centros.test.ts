import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente compartido: evita conectar a Postgres y nos deja espiar queries.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    centro: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
}));

import { CentrosService, CentrosController } from "./centros";

// redis fake: cached() ejecuta el fn directo; version fija.
const redis = {
  centrosVersion: vi.fn(async () => "0"),
  cached: vi.fn((_k: string, _ttl: number, fn: () => unknown) => fn()),
  bumpCentros: vi.fn(),
} as any;

const service = new CentrosService(redis);

const centroBase = {
  id: "c1",
  nombre: "Centro Uno",
  ciudad: "Caracas",
  estado: "DC",
  direccion: "Av 1",
  recibiendoAhora: true,
  horarioCierre: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CentrosService.list — sin coordenadas (paginación DB)", () => {
  it("pagina con skip/take y calcula hasNext", async () => {
    prismaMock.centro.findMany.mockResolvedValue([{ ...centroBase, insumos: [] }]);
    prismaMock.centro.count.mockResolvedValue(25);

    const res = await service.list({ page: 1, limit: 20 });

    expect(prismaMock.centro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(res.total).toBe(25);
    expect(res.hasNext).toBe(true); // 1*20 < 25
    expect(res.items[0].distanciaKm).toBe(null);
  });

  it("q arma OR case-insensitive sobre nombre y ciudad", async () => {
    prismaMock.centro.findMany.mockResolvedValue([]);
    prismaMock.centro.count.mockResolvedValue(0);

    await service.list({ q: "mara" });

    const where = prismaMock.centro.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { nombre: { contains: "mara", mode: "insensitive" } },
      { ciudad: { contains: "mara", mode: "insensitive" } },
    ]);
  });

  it("soloAbiertos y urgenciaAlta agregan sus filtros", async () => {
    prismaMock.centro.findMany.mockResolvedValue([]);
    prismaMock.centro.count.mockResolvedValue(0);

    await service.list({ soloAbiertos: true, urgenciaAlta: true });

    const where = prismaMock.centro.findMany.mock.calls[0][0].where;
    expect(where.recibiendoAhora).toBe(true);
    expect(where.insumos).toEqual({ some: { nivel: "URGENTE" } });
  });

  it("card: ordena URGENTE primero, marca prioridadAlta y limita a maxBadges (3)", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      {
        ...centroBase,
        insumos: [
          { nombre: "Ropa", nivel: "SUFICIENTE", categoria: "ROPA" },
          { nombre: "Agua", nivel: "URGENTE", categoria: "AGUA" },
          { nombre: "Comida", nivel: "NORMAL", categoria: "ALIMENTOS" },
          { nombre: "Mantas", nivel: "NORMAL", categoria: "ROPA" },
        ],
      },
    ]);
    prismaMock.centro.count.mockResolvedValue(1);

    const { items } = await service.list({});
    const card = items[0];

    expect(card.prioridadAlta).toBe(true);
    expect(card.necesidades).toHaveLength(3); // cap
    expect(card.necesidades[0].nivel).toBe("URGENTE"); // ordenado
    // proyección: no filtra PII
    expect(card).not.toHaveProperty("voluntarios");
    expect(card).not.toHaveProperty("latitud");
  });

  it("la cache key incluye filtros y página", async () => {
    prismaMock.centro.findMany.mockResolvedValue([]);
    prismaMock.centro.count.mockResolvedValue(0);

    await service.list({ page: 2, q: "x" });
    await service.list({ page: 3, q: "y" });

    const k1 = redis.cached.mock.calls[0][0];
    const k2 = redis.cached.mock.calls[1][0];
    expect(k1).not.toBe(k2);
    expect(k1).toContain("centros:list:v0:");
  });
});

describe("CentrosService.list — con coordenadas (proximidad)", () => {
  it("ordena por cercanía y filtra por radio", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      { ...centroBase, id: "lejos", latitud: 10.65, longitud: -71.64, insumos: [] },
      { ...centroBase, id: "cerca", latitud: 10.5, longitud: -66.9, insumos: [] },
    ]);

    const { items, total } = await service.list({ lat: 10.5, lng: -66.9, radiusKm: 50 });

    expect(items[0].id).toBe("cerca");
    expect(items.find((i) => i.id === "lejos")).toBeUndefined(); // fuera del radio
    expect(total).toBe(1);
    expect(items[0].distanciaKm).not.toBe(null);
  });
});

describe("CentrosController", () => {
  it("list delega la query al service", () => {
    const svc = { list: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new CentrosController(svc);
    const query = { q: "x", page: 2 };
    expect(ctrl.list(query as any)).toBe("ok");
    expect(svc.list).toHaveBeenCalledWith(query);
  });
});
