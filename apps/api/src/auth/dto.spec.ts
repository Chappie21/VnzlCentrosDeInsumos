import { describe, it, expect, afterEach, vi } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

// El portón vive en un feature flag de Railway; se mockea para prenderlo y apagarlo.
const { flagMock } = vi.hoisted(() => ({ flagMock: vi.fn(() => true) }));
vi.mock("../feature-flags", () => ({
  cedulaValidacionVe: flagMock,
  flagsSincronizados: () => true,
  FLAG_CEDULA_VE: "cedula-validacion-ve",
  initFeatureFlags: async () => true,
}));

import { RegisterDto } from "./dto";

const errores = async (data: Record<string, unknown>) =>
  (await validate(plainToInstance(RegisterDto, data))).flatMap((e) =>
    Object.keys(e.constraints ?? {}),
  );

const base = { telefono: "04141234567", password: "claveSegura1" };
const co = {
  pais: "CO",
  cedula: "1020304050",
  telefono: "3001234567",
  password: "claveSegura1",
};

afterEach(() => flagMock.mockReturnValue(true));

describe("RegisterDto — cuándo se exige el nombre", () => {
  // Venezuela con el portón activo: el nombre sale del registro civil.
  it("Venezuela NO lo exige (lo pone el registro)", async () => {
    expect(await errores({ ...base, pais: "VE", cedula: "V12345678" })).toEqual(
      [],
    );
  });

  // Colombia no tiene registro público que consultar.
  it("Colombia SÍ lo exige", async () => {
    expect(await errores(co)).toContain("isNotEmpty");
    expect(await errores({ ...co, nombre: "Ana Gómez" })).toEqual([]);
  });

  it("Colombia rechaza un nombre demasiado corto", async () => {
    expect(await errores({ ...co, nombre: "Ax" })).toContain("minLength");
  });

  // Si se usa el interruptor de emergencia, el formulario tiene que pedirlo.
  it("Venezuela SÍ lo exige con el portón apagado", async () => {
    flagMock.mockReturnValue(false);
    expect(
      await errores({ ...base, pais: "VE", cedula: "V12345678" }),
    ).toContain("isNotEmpty");
    expect(
      await errores({
        ...base,
        pais: "VE",
        cedula: "V12345678",
        nombre: "Pedro Pérez",
      }),
    ).toEqual([]);
  });
});

describe("RegisterDto — formato por país", () => {
  it("no cruza documentos ni teléfonos entre países", async () => {
    expect(
      await errores({ ...co, nombre: "Ana Gómez", cedula: "V12345678" }),
    ).toContain("isDocumentoDePais");
    expect(
      await errores({ ...co, nombre: "Ana Gómez", telefono: "04141234567" }),
    ).toContain("isTelefonoDePais");
    expect(
      await errores({ ...base, pais: "VE", cedula: "1020304050" }),
    ).toContain("isDocumentoDePais");
  });

  it("normaliza el documento venezolano antes de validar (dígitos sueltos)", async () => {
    expect(await errores({ ...base, pais: "VE", cedula: "12345678" })).toEqual(
      [],
    );
  });

  it("rechaza un país no soportado", async () => {
    expect(
      await errores({ ...base, pais: "AR", cedula: "12345678" }),
    ).toContain("isIn");
  });
});
