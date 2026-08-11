import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

// El portón vive en un feature flag de Railway. Se mockea el módulo para poder
// prender y apagar el interruptor sin hablar con Railway.
const { flagMock } = vi.hoisted(() => ({ flagMock: vi.fn(() => true) }));
vi.mock("./feature-flags", () => ({
  cedulaValidacionVe: flagMock,
  flagsSincronizados: () => true,
  FLAG_CEDULA_VE: "cedula-validacion-ve",
  initFeatureFlags: async () => true,
}));

import { CedulaService, interpretarRespuesta, validacionActiva } from "./cedula";

const portonVe = (activo: boolean) => flagMock.mockReturnValue(activo);

// Construye un CedulaService con `verificar` stubeado (sin red).
function withVerificar(result: any) {
  const s = new CedulaService();
  (s as any).verificar = async () => result;
  return s;
}

// Igual, pero registrando si `verificar` llegó a llamarse.
function espiando(result: any) {
  const s = new CedulaService();
  const verificar = vi.fn(async () => result);
  (s as any).verificar = verificar;
  return { service: s, verificar };
}

describe("interpretarRespuesta", () => {
  it("existe=true con data presente", () => {
    expect(interpretarRespuesta({ error: false, data: { primer_nombre: "Ana" } })).toEqual({
      existe: true,
      nombre: "Ana",
    });
  });
  it("existe=false sin data", () => {
    expect(interpretarRespuesta({ error: true })).toEqual({ existe: false, nombre: null });
  });
});

describe("validacionActiva (feature flag de Railway)", () => {
  afterEach(() => portonVe(true));

  it("sigue el valor del flag en Venezuela", () => {
    portonVe(true);
    expect(validacionActiva("VE")).toBe(true);
    portonVe(false);
    expect(validacionActiva("VE")).toBe(false);
  });

  it("Colombia nunca pasa por la API venezolana, esté como esté el flag", () => {
    portonVe(true);
    expect(validacionActiva("CO")).toBe(false);
    portonVe(false);
    expect(validacionActiva("CO")).toBe(false);
  });
});

// Portón apagado con el interruptor de emergencia (api.cedula.com.ve caída, etc).
describe("CedulaService.validarParaRegistro — portón APAGADO", () => {
  beforeEach(() => portonVe(false));
  afterEach(() => portonVe(true));

  it("sigue rechazando un formato inválido (sanidad de input, no depende del flag)", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("VE", "xx", "Juan"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("NO consulta la API y deja pasar con el nombre tecleado", async () => {
    const { service, verificar } = espiando({ existe: true, nombre: "OFICIAL" });
    const r = await service.validarParaRegistro("VE", "V12345678", "Juan Perez");
    expect(verificar).not.toHaveBeenCalled();
    expect(r).toEqual({ nombre: "Juan Perez", cedulaVerificada: null, cedulaNombre: null });
  });

  // Con el portón apagado el formulario TIENE que pedir el nombre. Si no llega,
  // cortamos: una cuenta sin nombre queda con identidad incompleta y su dueño no
  // puede crear centros ni aceptar invitaciones, sin ningún error visible.
  it("SIN nombre tecleado corta con 400 en vez de crear una cuenta sin nombre", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("VE", "V12345678"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acepta un documento colombiano", async () => {
    const r = await withVerificar(null).validarParaRegistro("CO", "1020304050", "Ana Gómez");
    expect(r).toEqual({ nombre: "Ana Gómez", cedulaVerificada: null, cedulaNombre: null });
  });
});

// Portón encendido: el comportamiento histórico venezolano, intacto.
describe("CedulaService.validarParaRegistro — portón ENCENDIDO (default)", () => {
  beforeEach(() => portonVe(true));

  it("rechaza un formato de cédula inválido", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("VE", "xx", "Juan"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("fail-open CON nombre de respaldo (Google): deja pasar, no verificado", async () => {
    const r = await withVerificar(null).validarParaRegistro("VE", "V12345678", "Juan Perez");
    expect(r).toEqual({ nombre: "Juan Perez", cedulaVerificada: null, cedulaNombre: null });
  });

  it("SIN respaldo y API caída (null): lanza 503 (no registra)", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("VE", "V12345678"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rechaza si la cédula no corresponde a una persona real", async () => {
    await expect(
      withVerificar({ existe: false, nombre: null }).validarParaRegistro("VE", "V12345678", "Juan"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("usa el nombre OFICIAL del registro cuando la cédula existe", async () => {
    const r = await withVerificar({ existe: true, nombre: "MARIA OFICIAL PEREZ" }).validarParaRegistro(
      "VE",
      "V12345678",
      "maria",
    );
    expect(r).toEqual({
      nombre: "MARIA OFICIAL PEREZ",
      cedulaVerificada: true,
      cedulaNombre: "MARIA OFICIAL PEREZ",
    });
  });

  // Colombia no tiene registro público que consultar: se salta siempre y el
  // nombre tecleado (que el DTO exige) es la única fuente.
  it("Colombia se salta la verificación y usa el nombre tecleado", async () => {
    const { service, verificar } = espiando({ existe: true, nombre: "OFICIAL" });
    const r = await service.validarParaRegistro("CO", "1020304050", "Ana Gómez");
    expect(verificar).not.toHaveBeenCalled();
    expect(r).toEqual({ nombre: "Ana Gómez", cedulaVerificada: null, cedulaNombre: null });
  });

  it("Colombia sin nombre corta con 400", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("CO", "1020304050"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
