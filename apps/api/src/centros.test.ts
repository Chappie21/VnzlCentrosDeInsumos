import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

// Mock del cliente compartido: evita conectar a Postgres y nos deja espiar queries.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    centro: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    historial: { count: vi.fn() },
    insumo: { findMany: vi.fn(), update: vi.fn() },
    voluntario: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    reporte: { upsert: vi.fn() },
    usuario: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  CategoriaInsumo: { AGUA: "AGUA", MEDICAMENTOS: "MEDICAMENTOS", ROPA: "ROPA", ALIMENTOS: "ALIMENTOS", HERRAMIENTAS: "HERRAMIENTAS" },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
  EstadoVerificacion: { PENDIENTE: "PENDIENTE", VERIFICADO: "VERIFICADO", RECHAZADO: "RECHAZADO" },
  TipoMovimiento: { DONACION: "DONACION", CARGA_INICIAL: "CARGA_INICIAL", AJUSTE: "AJUSTE", SALIDA: "SALIDA" },
  MotivoReporte: { NO_EXISTE: "NO_EXISTE", INFO_INCORRECTA: "INFO_INCORRECTA", ENGANOSO: "ENGANOSO" },
}));

// No tocar disco al subir fotos en los tests.
vi.mock("fs", () => ({ mkdirSync: vi.fn(), writeFileSync: vi.fn() }));

import {
  CentrosService,
  CentrosController,
  CreateCentroDto,
  InsumoInicialDto,
  UpdateCentroDto,
  UpdateOperativoDto,
  UpdateUmbralesDto,
} from "./centros";

// redis fake: cached() ejecuta el fn directo; version fija.
const redis = {
  centrosVersion: vi.fn(async () => "0"),
  cached: vi.fn((_k: string, _ttl: number, fn: () => unknown) => fn()),
  bumpCentros: vi.fn(),
} as any;

const cedula = { verificar: vi.fn().mockResolvedValue(null) } as any;
const email = { notificarCentroNuevo: vi.fn().mockResolvedValue(undefined) } as any;
const service = new CentrosService(redis, cedula, email);

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

  it("siembra el inventario inicial como Historial tipo CARGA_INICIAL en la misma tx", async () => {
    const creado = { ...centroBase, id: "new-id" };
    const txMock = {
      centro: { create: vi.fn().mockResolvedValue(creado) },
      voluntario: { create: vi.fn().mockResolvedValue({}) },
      insumo: { create: vi.fn().mockResolvedValue({ id: "i-1" }), update: vi.fn() },
      historial: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

    const dto = {
      nombre: "C", estado: "DC", ciudad: "Caracas", direccion: "Av",
      insumos: [{ nombre: "Agua", categoria: "AGUA", cantidad: 10 }],
    } as any;
    await service.create("fp-1", dto);

    // el centro se crea sin el campo insumos (no es columna de Centro)
    expect(txMock.centro.create).toHaveBeenCalledWith({
      data: { nombre: "C", estado: "DC", ciudad: "Caracas", direccion: "Av" },
    });
    expect(txMock.insumo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ centroId: "new-id", nombre: "Agua", cantidadTotal: 0 }) }),
    );
    expect(txMock.historial.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ insumoId: "i-1", cantidad: 10, tipo: "CARGA_INICIAL" }) }),
    );
    expect(txMock.insumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "i-1" }, data: { cantidadTotal: { increment: 10 } } }),
    );
  });

  it("admite insumo inicial con cantidad 0 (decisión B3)", async () => {
    const errs = await validate(
      plainToInstance(InsumoInicialDto, { nombre: "Agua", cantidad: 0 }),
    );
    expect(errs).toHaveLength(0);
  });

  it("rechaza cantidad inicial negativa", async () => {
    const errs = await validate(
      plainToInstance(InsumoInicialDto, { nombre: "Agua", cantidad: -1 }),
    );
    expect(errs.flatMap((e) => Object.keys(e.constraints ?? {}))).toContain("min");
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

describe("CentrosService.listarVoluntarios — gestión de miembros", () => {
  it("filtra por centro, ordena (JEFE primero) y aplana sin exponer usuarioId", async () => {
    prismaMock.voluntario.findMany.mockResolvedValue([
      {
        id: "v-jefe",
        rol: "JEFE",
        asignadoEn: new Date("2026-01-01"),
        usuario: { nombre: "Ana", cedula: "V-1", telefono: "0414-1" },
      },
      {
        id: "v-vol",
        rol: "VOLUNTARIO",
        asignadoEn: new Date("2026-02-01"),
        usuario: { nombre: "Beto", cedula: "V-2", telefono: "0414-2" },
      },
    ]);

    const res = await service.listarVoluntarios("c1");

    const arg = prismaMock.voluntario.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ centroId: "c1" });
    expect(arg.orderBy).toEqual([{ rol: "asc" }, { asignadoEn: "asc" }]);
    // proyección: nunca el fingerprint/usuarioId
    expect(arg.select).not.toHaveProperty("usuarioId");

    expect(res).toEqual([
      { id: "v-jefe", nombre: "Ana", cedula: "V-1", telefono: "0414-1", rol: "JEFE", asignadoEn: new Date("2026-01-01") },
      { id: "v-vol", nombre: "Beto", cedula: "V-2", telefono: "0414-2", rol: "VOLUNTARIO", asignadoEn: new Date("2026-02-01") },
    ]);
    expect(res[0]).not.toHaveProperty("usuarioId");
  });
});

describe("CentrosService.removerVoluntario — remoción (solo JEFE)", () => {
  it("borra la fila, invalida cache y devuelve { ok: true }", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ centroId: "c1", rol: "VOLUNTARIO" });
    prismaMock.voluntario.delete.mockResolvedValue({});

    const res = await service.removerVoluntario("c1", "v-vol");

    expect(prismaMock.voluntario.delete).toHaveBeenCalledWith({ where: { id: "v-vol" } });
    expect(redis.bumpCentros).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: true });
  });

  it("rechaza (NotFound) si la fila no existe", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue(null);
    await expect(service.removerVoluntario("c1", "ghost")).rejects.toThrow(/no encontrado/i);
    expect(prismaMock.voluntario.delete).not.toHaveBeenCalled();
  });

  it("rechaza (NotFound) si la fila es de otro centro (sin borrado cruzado)", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ centroId: "otro", rol: "VOLUNTARIO" });
    await expect(service.removerVoluntario("c1", "v-vol")).rejects.toThrow(/no encontrado/i);
    expect(prismaMock.voluntario.delete).not.toHaveBeenCalled();
  });

  it("rechaza remover a un JEFE (BadRequest)", async () => {
    prismaMock.voluntario.findUnique.mockResolvedValue({ centroId: "c1", rol: "JEFE" });
    await expect(service.removerVoluntario("c1", "v-jefe")).rejects.toThrow(/jefe/i);
    expect(prismaMock.voluntario.delete).not.toHaveBeenCalled();
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

  it("mios usa el userId del request y delega al service", () => {
    const svc = { mias: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new CentrosController(svc);
    const req = { userId: "fp-9" };
    expect(ctrl.mias(req as any)).toBe("ok");
    expect(svc.mias).toHaveBeenCalledWith("fp-9");
  });

  it("listarVoluntarios delega el centroId al service", () => {
    const svc = { listarVoluntarios: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new CentrosController(svc);
    expect(ctrl.listarVoluntarios("c1")).toBe("ok");
    expect(svc.listarVoluntarios).toHaveBeenCalledWith("c1");
  });

  it("removerVoluntario delega centroId + voluntarioId al service", () => {
    const svc = { removerVoluntario: vi.fn().mockReturnValue("ok") } as any;
    const ctrl = new CentrosController(svc);
    expect(ctrl.removerVoluntario("c1", "v-9")).toBe("ok");
    expect(svc.removerVoluntario).toHaveBeenCalledWith("c1", "v-9");
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

    // donaciones = solo movimientos tipo DONACION (carga inicial/ajuste no cuentan)
    expect(prismaMock.historial.count).toHaveBeenCalledWith({
      where: { tipo: "DONACION", insumo: { centroId: "c1" } },
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

describe("CentrosService.verificar", () => {
  it("setea estado + verificadoEn + verificadoPorId y bumpea el directorio", async () => {
    prismaMock.centro.update.mockResolvedValue({});
    await service.verificar("c1", "VERIFICADO" as any, "admin-1");
    const arg = prismaMock.centro.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "c1" });
    expect(arg.data.verificacion).toBe("VERIFICADO");
    expect(arg.data.verificadoEn).toBeInstanceOf(Date);
    expect(arg.data.verificadoPorId).toBe("admin-1");
    expect(redis.bumpCentros).toHaveBeenCalled();
  });
});

const modRow = (over: Record<string, any> = {}) => ({
  id: "c1", nombre: "C", estado: "DC", ciudad: "Caracas", direccion: "Av",
  verificacion: "PENDIENTE", verificadoEn: null, creadoEn: new Date(),
  fotoUrl: null, latitud: null, longitud: null, geoLat: null, geoLng: null,
  voluntarios: [], _count: { reportes: 0 }, reportes: [],
  ...over,
});

describe("CentrosService.moderacion", () => {
  it("calcula distanciaGeoM (haversine) y mapea al responsable", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      modRow({
        latitud: 10.5061, longitud: -66.9146, geoLat: 10.4339, geoLng: -66.8758,
        voluntarios: [{ usuario: { nombre: "Ana", cedula: "V-1", telefono: "0412" } }],
      }),
    ]);
    const [m] = await service.moderacion("PENDIENTE" as any);
    expect(m.distanciaGeoM).toBeGreaterThan(7000);
    expect(m.distanciaGeoM).toBeLessThan(10000);
    expect(m.responsable).toEqual({ nombre: "Ana", cedula: "V-1", telefono: "0412" });
  });

  it("distanciaGeoM null si falta alguna coordenada", async () => {
    prismaMock.centro.findMany.mockResolvedValue([modRow({ latitud: 10.5, longitud: -66.9 })]);
    const [m] = await service.moderacion();
    expect(m.distanciaGeoM).toBeNull();
    expect(m.responsable).toBeNull();
  });

  it("incluye reportados aunque no sean PENDIENTE y los prioriza (flag >= 3)", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      modRow({ id: "pend", verificacion: "PENDIENTE", _count: { reportes: 0 }, reportes: [] }),
      modRow({
        id: "rep", verificacion: "VERIFICADO", _count: { reportes: 4 },
        reportes: [{ motivo: "ENGANOSO", comentario: null, creadoEn: new Date() }],
      }),
    ]);
    const res = await service.moderacion("PENDIENTE" as any);

    // el filtro incluye también los reportados (OR), no solo el estado
    const where = prismaMock.centro.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeTruthy();
    // el reportado (>=3) va primero
    expect(res[0].id).toBe("rep");
    expect(res[0].reportado).toBe(true);
    expect(res[0].reportesCount).toBe(4);
    expect(res[1].reportado).toBe(false);
  });
});

describe("CentrosService.reportar", () => {
  it("hace upsert por (centroId, fingerprint) con el motivo", async () => {
    prismaMock.reporte.upsert.mockResolvedValue({});
    await service.reportar("c1", "fp-1", "NO_EXISTE" as any, "ya cerró");
    const arg = prismaMock.reporte.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ centroId_fingerprint: { centroId: "c1", fingerprint: "fp-1" } });
    expect(arg.create).toMatchObject({
      centroId: "c1", fingerprint: "fp-1", motivo: "NO_EXISTE", comentario: "ya cerró",
    });
    expect(arg.update.motivo).toBe("NO_EXISTE");
  });
});

describe("CentrosService.setFoto", () => {
  it("rechaza un data URL que no es imagen", async () => {
    await expect(service.setFoto("c1", "data:text/plain;base64,aaaa")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("acepta una imagen válida, guarda y apunta fotoUrl", async () => {
    prismaMock.centro.update.mockResolvedValue({});
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const res = await service.setFoto("c1", png);
    expect(res.fotoUrl).toMatch(/^\/uploads\/centros\/c1-\d+\.png$/);
    expect(prismaMock.centro.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { fotoUrl: res.fotoUrl } }),
    );
  });
});

describe("CentrosService.detallePublico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("proyecta payload público: cantidad + voluntarios, ordena URGENTE primero, sin PII", async () => {
    prismaMock.centro.findUnique.mockResolvedValue({
      id: "c1", nombre: "Uno", estado: "DC", ciudad: "Caracas", direccion: "Av 1",
      latitud: 10.5, longitud: -66.9, recibiendoAhora: true, horarioCierre: null,
      insumos: [
        { nombre: "Ropa", nivel: "SUFICIENTE", categoria: "ROPA", cantidadTotal: 5 },
        { nombre: "Agua", nivel: "URGENTE", categoria: "AGUA", cantidadTotal: 12 },
      ],
      _count: { voluntarios: 3 },
    });

    const r = await service.detallePublico("c1");

    expect(r.necesidades[0].nivel).toBe("URGENTE");
    expect(r.necesidades[0].cantidad).toBe(12);
    expect(r.voluntarios).toBe(3);
    expect(r).not.toHaveProperty("rol");
  });

  it("lanza 404 si el centro no existe", async () => {
    prismaMock.centro.findUnique.mockResolvedValue(null);
    await expect(service.detallePublico("nope")).rejects.toThrow("Centro no encontrado");
  });
});

describe("CentrosService.mapaCoords", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide solo centros con coords y proyecta el punto del mapa", async () => {
    prismaMock.centro.findMany.mockResolvedValue([
      { id: "c1", nombre: "Uno", ciudad: "Caracas", latitud: 10.5, longitud: -66.9, recibiendoAhora: true },
    ]);

    const puntos = await service.mapaCoords();

    expect(prismaMock.centro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { latitud: { not: null }, longitud: { not: null } },
      }),
    );
    expect(puntos).toEqual([
      { id: "c1", nombre: "Uno", ciudad: "Caracas", latitud: 10.5, longitud: -66.9, recibiendoAhora: true },
    ]);
  });
});

describe("CentrosService.actualizarUmbrales — nivel automático (JEFE)", () => {
  beforeEach(() => {
    // forma array de $transaction: ejecuta los updates en paralelo.
    prismaMock.$transaction.mockImplementation(async (ops: any) => Promise.all(ops));
  });

  it("setea umbrales y recalcula nivel con el stock actual", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 2 }]);

    await service.actualizarUmbrales("c1", {
      insumos: [{ insumoId: "i1", umbralUrgente: 3, umbralSuficiente: 10 }],
    });

    // stock 2 <= 3 -> URGENTE; se persiste junto con los umbrales.
    expect(prismaMock.insumo.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { umbralUrgente: 3, umbralSuficiente: 10, nivel: "URGENTE" },
    });
    expect(redis.bumpCentros).toHaveBeenCalled();
  });

  it("limpiar umbrales (null) no toca el nivel (vuelve a manual)", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 2 }]);

    await service.actualizarUmbrales("c1", {
      insumos: [{ insumoId: "i1", umbralUrgente: null, umbralSuficiente: null }],
    });

    expect(prismaMock.insumo.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { umbralUrgente: null, umbralSuficiente: null },
    });
  });

  it("rechaza umbralUrgente >= umbralSuficiente", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([{ id: "i1", cantidadTotal: 2 }]);
    await expect(
      service.actualizarUmbrales("c1", {
        insumos: [{ insumoId: "i1", umbralUrgente: 10, umbralSuficiente: 5 }],
      }),
    ).rejects.toThrow(/menor que/i);
  });

  it("rechaza un insumo de otro centro", async () => {
    prismaMock.insumo.findMany.mockResolvedValue([]); // no pertenece a c1
    await expect(
      service.actualizarUmbrales("c1", {
        insumos: [{ insumoId: "ajeno", umbralUrgente: 1, umbralSuficiente: 5 }],
      }),
    ).rejects.toThrow(/no pertenece/i);
  });
});
