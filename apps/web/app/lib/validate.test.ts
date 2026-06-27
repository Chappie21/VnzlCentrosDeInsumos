import { describe, it, expect } from "vitest";
import { normalizeCedula, normalizeTelefono, validateOnboarding } from "./validate";

describe("normalize", () => {
  it("cédula: dígitos solos -> prefijo V", () => {
    expect(normalizeCedula("12345678")).toBe("V12345678");
  });
  it("cédula: minúscula + guion -> canónica", () => {
    expect(normalizeCedula("v-12345678")).toBe("V12345678");
  });
  it("teléfono: quita guiones y espacios", () => {
    expect(normalizeTelefono("0414-123 4567")).toBe("04141234567");
  });
});

describe("validateOnboarding", () => {
  const ok = { nombre: "Ana Perez", cedula: "12345678", telefono: "0414-1234567" };

  it("acepta entrada venezolana típica (sin errores)", () => {
    expect(validateOnboarding(ok)).toEqual({});
  });

  it("acepta variantes de cédula y teléfono", () => {
    expect(validateOnboarding({ ...ok, cedula: "V12345678" })).toEqual({});
    expect(validateOnboarding({ ...ok, cedula: "E1234567" })).toEqual({});
    expect(validateOnboarding({ ...ok, telefono: "+584141234567" })).toEqual({});
    expect(validateOnboarding({ ...ok, telefono: "04141234567" })).toEqual({});
  });

  it("rechaza nombre corto, cédula y teléfono inválidos", () => {
    const e = validateOnboarding({ nombre: "Ax", cedula: "abc", telefono: "12345" });
    expect(e.nombre).toBeDefined();
    expect(e.cedula).toBeDefined();
    expect(e.telefono).toBeDefined();
  });
});
