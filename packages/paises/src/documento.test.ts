import { describe, it, expect } from "vitest";
import { parseDocumento, normalizarDocumento, esTelefonoValido } from "./documento";

describe("parseDocumento — Venezuela", () => {
  it("acepta V con guión y normaliza (case-insensitive)", () => {
    const r = parseDocumento("VE", "v-12345678");
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ tipo: "V", numero: 12345678, formatted: "V-12345678" });
  });

  it("acepta E sin guión", () => {
    expect(parseDocumento("VE", "E1234567").valid).toBe(true);
  });

  it("acepta separadores de miles (V-28.252.900)", () => {
    const r = parseDocumento("VE", "V-28.252.900");
    expect(r.valid).toBe(true);
    expect(r.data?.numero).toBe(28252900);
    expect(r.data?.formatted).toBe("V-28252900");
  });

  it("rechaza sin prefijo de nacionalidad", () => {
    expect(parseDocumento("VE", "12345678").valid).toBe(false);
  });

  it("rechaza número fuera de rango", () => {
    expect(parseDocumento("VE", "V-99").valid).toBe(false);
  });

  it("rechaza nacionalidad inválida", () => {
    expect(parseDocumento("VE", "X-12345678").valid).toBe(false);
  });
});

describe("parseDocumento — Colombia", () => {
  it("acepta cédula nueva de 10 dígitos", () => {
    const r = parseDocumento("CO", "1020304050");
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ numero: 1020304050, formatted: "1020304050" });
  });

  it("acepta cédula vieja de 8 dígitos y separadores de miles", () => {
    expect(parseDocumento("CO", "12345678").valid).toBe(true);
    expect(parseDocumento("CO", "1.020.304.050").data?.numero).toBe(1020304050);
  });

  it("rechaza el prefijo de nacionalidad venezolano", () => {
    expect(parseDocumento("CO", "V1020304050").valid).toBe(false);
  });

  it("rechaza demasiado corta o demasiado larga", () => {
    expect(parseDocumento("CO", "12345").valid).toBe(false);
    expect(parseDocumento("CO", "12345678901").valid).toBe(false);
  });
});

describe("normalizarDocumento", () => {
  it("prefija V a los dígitos sueltos solo en Venezuela", () => {
    expect(normalizarDocumento("VE", "12345678")).toBe("V12345678");
  });

  // Si esto se rompe, un colombiano queda fuera de su propia cuenta al hacer login.
  it("NO prefija V en Colombia", () => {
    expect(normalizarDocumento("CO", "1020304050")).toBe("1020304050");
  });

  it("limpia puntos, espacios y guiones en ambos países", () => {
    expect(normalizarDocumento("VE", "v-28.252.900")).toBe("V28252900");
    expect(normalizarDocumento("CO", "1.020.304.050")).toBe("1020304050");
  });
});

describe("esTelefonoValido", () => {
  it("acepta móviles venezolanos", () => {
    expect(esTelefonoValido("VE", "04141234567")).toBe(true);
    expect(esTelefonoValido("VE", "+584141234567")).toBe(true);
  });

  it("acepta móviles colombianos", () => {
    expect(esTelefonoValido("CO", "3001234567")).toBe(true);
    expect(esTelefonoValido("CO", "+573001234567")).toBe(true);
  });

  it("no cruza países", () => {
    expect(esTelefonoValido("CO", "04141234567")).toBe(false);
    expect(esTelefonoValido("VE", "3001234567")).toBe(false);
  });

  it("rechaza fijos colombianos (no empiezan en 3)", () => {
    expect(esTelefonoValido("CO", "6012345678")).toBe(false);
  });
});
