import { describe, it, expect } from "vitest";
import {
  normalizeCedula,
  normalizeTelefono,
  validateOnboarding,
  validateCentro,
} from "./validate";

describe("normalize", () => {
  it("documento VE: dígitos solos -> prefijo V", () => {
    expect(normalizeCedula("VE", "12345678")).toBe("V12345678");
  });
  it("documento VE: minúscula + guion -> canónica", () => {
    expect(normalizeCedula("VE", "v-12345678")).toBe("V12345678");
  });
  // Si esto se rompe, el colombiano queda fuera de su cuenta al hacer login.
  it("documento CO: NO recibe el prefijo V", () => {
    expect(normalizeCedula("CO", "1020304050")).toBe("1020304050");
  });
  it("teléfono: quita guiones y espacios", () => {
    expect(normalizeTelefono("0414-123 4567")).toBe("04141234567");
  });
});

describe("validateOnboarding — Venezuela", () => {
  const ok = { pais: "VE" as const, nombre: "Ana Perez", cedula: "12345678", telefono: "0414-1234567" };

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
    const e = validateOnboarding({ ...ok, nombre: "Ax", cedula: "abc", telefono: "12345" });
    expect(e.nombre).toBeDefined();
    expect(e.cedula).toBeDefined();
    expect(e.telefono).toBeDefined();
  });
});

describe("validateOnboarding — Colombia", () => {
  const ok = { pais: "CO" as const, nombre: "Ana Gómez", cedula: "1020304050", telefono: "3001234567" };

  it("acepta entrada colombiana típica", () => {
    expect(validateOnboarding(ok)).toEqual({});
    expect(validateOnboarding({ ...ok, telefono: "+573001234567" })).toEqual({});
  });

  it("no acepta formatos venezolanos", () => {
    expect(validateOnboarding({ ...ok, cedula: "V12345678" }).cedula).toBeDefined();
    expect(validateOnboarding({ ...ok, telefono: "04141234567" }).telefono).toBeDefined();
  });
});

describe("validateCentro", () => {
  const ok = {
    pais: "VE" as const,
    nombre: "Centro Deportivo Municipal",
    ciudad: "Maracaibo",
    estado: "Zulia",
    direccion: "Av. 5 de Julio, C.P. 4001",
  };

  it("acepta un centro válido (sin errores)", () => {
    expect(validateCentro(ok)).toEqual({});
  });

  it("acepta un centro colombiano", () => {
    expect(
      validateCentro({
        ...ok,
        pais: "CO",
        estado: "Antioquia",
        ciudad: "Medellín",
      }),
    ).toEqual({});
  });

  it("rechaza geografía del país equivocado", () => {
    const e = validateCentro({ ...ok, pais: "CO" });
    expect(e.estado).toBeDefined();
  });

  it("rechaza ciudad que no pertenece al estado", () => {
    const e = validateCentro({ ...ok, ciudad: "Baruta" });
    expect(e.ciudad).toBeDefined();
  });

  it("acepta coordenadas dentro de rango", () => {
    expect(validateCentro({ ...ok, latitud: 10.5, longitud: -71.6 })).toEqual({});
  });

  it("rechaza nombre faltante", () => {
    const e = validateCentro({ ...ok, nombre: "" });
    expect(e.nombre).toBeDefined();
  });

  it("rechaza dirección corta", () => {
    const e = validateCentro({ ...ok, direccion: "Av." });
    expect(e.direccion).toBeDefined();
  });

  it("rechaza coordenadas fuera de rango", () => {
    const e = validateCentro({ ...ok, latitud: 120, longitud: -500 });
    expect(e.latitud).toBeDefined();
    expect(e.longitud).toBeDefined();
  });
});
