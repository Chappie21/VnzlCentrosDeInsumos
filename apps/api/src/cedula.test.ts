import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente compartido: cedula.ts importa prisma a nivel de módulo
// (para validarYGuardar), así que hay que mockearlo antes de importar.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  Prisma: {},
}));

import { construirNombre, interpretarRespuesta, CedulaService } from "./cedula";

describe("cédula API — parseo de la respuesta", () => {
  it("construirNombre arma el nombre completo y filtra vacíos", () => {
    expect(
      construirNombre({ primer_nombre: "JUAN", segundo_nombre: "", primer_apellido: "PEREZ", segundo_apellido: "GOMEZ" }),
    ).toBe("JUAN PEREZ GOMEZ");
    expect(construirNombre({ primer_nombre: "ANA", primer_apellido: "DIAZ" })).toBe("ANA DIAZ");
  });

  it("interpretarRespuesta: con data → existe + nombre", () => {
    const r = interpretarRespuesta({ error: false, data: { primer_nombre: "JUAN", primer_apellido: "PEREZ" } });
    expect(r).toEqual({ existe: true, nombre: "JUAN PEREZ" });
  });

  it("interpretarRespuesta: sin data → no existe", () => {
    expect(interpretarRespuesta({ error: true, error_str: "no encontrado", data: false })).toEqual({
      existe: false,
      nombre: null,
    });
    expect(interpretarRespuesta(null)).toEqual({ existe: false, nombre: null });
  });
});

describe("CedulaService.validarYGuardar", () => {
  let svc: CedulaService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CedulaService();
  });

  it("(a) salta si cedulaVerificadaEn ya está seteada (ya intentada)", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      cedula: "V12345678",
      cedulaVerificadaEn: new Date(),
    });
    const verificar = vi.spyOn(svc, "verificar");

    await svc.validarYGuardar("u1");

    expect(verificar).not.toHaveBeenCalled();
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("(b) en verificar exitoso escribe los tres campos", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      cedula: "V12345678",
      cedulaVerificadaEn: null,
    });
    vi.spyOn(svc, "verificar").mockResolvedValue({ existe: true, nombre: "JUAN PEREZ" });

    await svc.validarYGuardar("u1");

    expect(prismaMock.usuario.update).toHaveBeenCalledTimes(1);
    const arg = prismaMock.usuario.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "u1" });
    expect(arg.data.cedulaVerificada).toBe(true);
    expect(arg.data.cedulaNombre).toBe("JUAN PEREZ");
    expect(arg.data.cedulaVerificadaEn).toBeInstanceOf(Date);
  });

  it("(c) si verificar devuelve null (API caída/sin config) no escribe → reintenta luego", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      cedula: "V12345678",
      cedulaVerificadaEn: null,
    });
    vi.spyOn(svc, "verificar").mockResolvedValue(null);

    await svc.validarYGuardar("u1");

    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("(d) cédula con formato inválido → no consulta ni escribe", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      cedula: "X-12345678", // prefijo inválido
      cedulaVerificadaEn: null,
    });
    const verificar = vi.spyOn(svc, "verificar");

    await svc.validarYGuardar("u1");

    expect(verificar).not.toHaveBeenCalled();
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("sin cédula → no consulta ni escribe", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ cedula: null, cedulaVerificadaEn: null });
    const verificar = vi.spyOn(svc, "verificar");

    await svc.validarYGuardar("u1");

    expect(verificar).not.toHaveBeenCalled();
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });
});
