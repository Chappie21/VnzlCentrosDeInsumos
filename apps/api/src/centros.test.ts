import { describe, it, expect, vi, beforeEach } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

// Mock del cliente compartido: evita conectar a Postgres y nos deja espiar queries.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    centro: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    historial: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
}));

import {
  CentrosService,
  CentrosController,
  CreateCentroDto,
  UpdateCentroDto,
  UpdateOperativoDto,
} from "./centros";

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

describe("CentrosService.create — escritura transaccional", () => {
  it("crea el Centro + Voluntario en la misma tx, invalida cache y devuelve la fila", async () => {
    const fingerprint = "fp-123";
    const dto = {
      nombre: "Centro Nuevo",
      estado: "DC",
      ciudad: "Caracas",
      direccion: "Av 2",
    } as any;
    const creado = { ...centroBase, id: "new-id", nombre: "Centro Nuevo", recibiendoAhora: true };

    // tx expone los mismos modelos que usa create(); centro.create resuelve la fila.
    const txMock = {
      centro: { create: vi.fn().mockResolvedValue(creado) },
      voluntario: { create: vi.fn().mockResolvedValue({}) },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

    const res = await service.create(fingerprint, dto);

    expect(txMock.centro.create).toHaveBeenCalledWith({ data: dto });
    expect(txMock.voluntario.create).toHaveBeenCalledWith({
      data: { usuarioId: fingerprint, centroId: creado.id, rol: "JEFE" },
    });
    expect(redis.bumpCentros).toHaveBeenCalledTimes(1);
    expect(res).toBe(creado);
  });
});

describe("CentrosService.mias — centros del voluntario", () => {
  it("filtra por el usuarioId del fingerprint", async () => {
    prismaMock.centro.findMany.mockResolvedValue([]);

    const res = await service.mias("fp-123");

    expect(res).toEqual([]);
    const arg = prismaMock.centro.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ voluntarios: { some: { usuarioId: "fp-123" } } });
  });

  it("expone insumos con cantidadTotal y la cuenta de voluntarios; sin PII", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      {
        ...centroBase,
        insumos: [
          { id: "i1", nombre: "Agua", nivel: "URGENTE", categoria: "AGUA", cantidadTotal: 12 },
        ],
        _count: { voluntarios: 3 },
        voluntarios: [{ rol: "JEFE" }],
      },
    ]);

    const res = await service.mias("fp-123");

    expect(res).toHaveLength(1);
    expect(res[0].voluntarios).toBe(3);
    expect(res[0].rol).toBe("JEFE");
    expect(res[0].insumos[0]).toEqual({
      id: "i1",
      nombre: "Agua",
      nivel: "URGENTE",
      categoria: "AGUA",
      cantidadTotal: 12,
    });
    expect(res[0]).not.toHaveProperty("_count");
    expect(res[0]).not.toHaveProperty("latitud");
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

  it("mios usa el fingerprint del header y delega al service", () => {
    const svc = { mias: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new CentrosController(svc);
    const req = { header: (h: string) => (h === "x-fingerprint" ? "fp-9" : undefined) };
    expect(ctrl.mias(req as any)).toBe("ok");
    expect(svc.mias).toHaveBeenCalledWith("fp-9");
  });
});

describe("CentrosService.detalle — dashboard de miembros", () => {
  it("proyecta coords + insumos con descripcion/cantidadTotal, conteo y rol; sin PII", async () => {
    prismaMock.centro.findUniqueOrThrow.mockResolvedValue({
      ...centroBase,
      latitud: 10.5,
      longitud: -66.9,
      creadoEn: new Date("2026-01-01"),
      insumos: [
        { id: "i1", nombre: "Agua", descripcion: "Botellones", nivel: "URGENTE", categoria: "AGUA", cantidadTotal: 12 },
      ],
      _count: { voluntarios: 4 },
      voluntarios: [{ rol: "JEFE" }],
    });
    prismaMock.historial.count.mockResolvedValue(7);

    const res = await service.detalle("fp-123", "c1");

    // filtra la relación voluntarios al usuario actual (take 1) para exponer su rol
    const arg = prismaMock.centro.findUniqueOrThrow.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "c1" });
    expect(arg.select.voluntarios.where).toEqual({ usuarioId: "fp-123" });

    // donaciones = entradas de Historial (cantidad > 0) de los insumos del centro
    expect(prismaMock.historial.count).toHaveBeenCalledWith({
      where: { cantidad: { gt: 0 }, insumo: { centroId: "c1" } },
    });

    expect(res.latitud).toBe(10.5);
    expect(res.voluntarios).toBe(4);
    expect(res.donaciones).toBe(7);
    expect(res.rol).toBe("JEFE");
    expect(res.insumos[0]).toEqual({
      id: "i1",
      nombre: "Agua",
      descripcion: "Botellones",
      nivel: "URGENTE",
      categoria: "AGUA",
      cantidadTotal: 12,
    });
    expect(res).not.toHaveProperty("_count");
    expect(res).not.toHaveProperty("voluntariosList");
  });

  it("rol cae a VOLUNTARIO si la relación filtrada viene vacía", async () => {
    prismaMock.centro.findUniqueOrThrow.mockResolvedValue({
      ...centroBase,
      latitud: null,
      longitud: null,
      creadoEn: new Date(),
      insumos: [],
      _count: { voluntarios: 1 },
      voluntarios: [],
    });
    prismaMock.historial.count.mockResolvedValue(0);
    const res = await service.detalle("fp-x", "c1");
    expect(res.rol).toBe("VOLUNTARIO");
  });
});

describe("CentrosService.actualizar / actualizarOperativo — escritura + bump", () => {
  it("actualizar pasa solo los campos del dto y bumpea el directorio", async () => {
    prismaMock.centro.update.mockResolvedValue({ ...centroBase });
    const dto = { nombre: "Nuevo" } as any;

    await service.actualizar("c1", dto);

    expect(prismaMock.centro.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: dto });
    expect(redis.bumpCentros).toHaveBeenCalledTimes(1);
  });

  it("actualizarOperativo persiste recibiendoAhora/horarioCierre y bumpea", async () => {
    prismaMock.centro.update.mockResolvedValue({ ...centroBase });
    const dto = { recibiendoAhora: false, horarioCierre: "" } as any;

    await service.actualizarOperativo("c1", dto);

    expect(prismaMock.centro.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: dto });
    expect(redis.bumpCentros).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateCentroDto — whitelist y regla ciudad⇒estado", () => {
  const errores = async (data: Record<string, unknown>) =>
    (await validate(plainToInstance(UpdateCentroDto, data))).flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );

  it("acepta un patch parcial (solo nombre)", async () => {
    expect(await errores({ nombre: "X" })).toHaveLength(0);
  });

  it("acepta estado + ciudad coherentes", async () => {
    expect(await errores({ estado: "Miranda", ciudad: "Baruta" })).toHaveLength(0);
  });

  it("rechaza ciudad sin estado (estado pasa a ser requerido)", async () => {
    const e = await errores({ ciudad: "Baruta" });
    expect(e).toContain("isIn"); // estado ausente => falla la whitelist
  });

  it("rechaza estado fuera de la whitelist", async () => {
    expect(await errores({ estado: "Narnia", ciudad: "Baruta" })).toContain("isIn");
  });

  it("rechaza ciudad que no pertenece al estado", async () => {
    expect(await errores({ estado: "Miranda", ciudad: "Maracaibo" })).toContain("isCiudadDeEstado");
  });
});

describe("UpdateOperativoDto — tipos", () => {
  it("acepta boolean + string (y vacío para limpiar)", async () => {
    const errs = await validate(
      plainToInstance(UpdateOperativoDto, { recibiendoAhora: true, horarioCierre: "" }),
    );
    expect(errs).toHaveLength(0);
  });

  it("rechaza recibiendoAhora no booleano", async () => {
    const errs = await validate(
      plainToInstance(UpdateOperativoDto, { recibiendoAhora: "sí" }),
    );
    expect(errs.flatMap((e) => Object.keys(e.constraints ?? {}))).toContain("isBoolean");
  });
});

describe("CreateCentroDto — whitelist estado/ciudad (@vnzl/venezuela)", () => {
  const base = { nombre: "Centro X", direccion: "Av Principal 123" };
  const errores = async (data: Record<string, unknown>) =>
    (await validate(plainToInstance(CreateCentroDto, data))).flatMap((e) =>
      Object.keys(e.constraints ?? {}),
    );

  it("acepta estado real + ciudad de ese estado", async () => {
    const errs = await validate(
      plainToInstance(CreateCentroDto, { ...base, estado: "Miranda", ciudad: "Baruta" }),
    );
    expect(errs).toHaveLength(0);
  });

  it("rechaza estado fuera de la lista", async () => {
    const e = await errores({ ...base, estado: "Narnia", ciudad: "Baruta" });
    expect(e).toContain("isIn");
  });

  it("rechaza ciudad que no pertenece al estado", async () => {
    const e = await errores({ ...base, estado: "Miranda", ciudad: "Maracaibo" });
    expect(e).toContain("isCiudadDeEstado");
  });
});
