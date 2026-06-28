import { describe, it, expect } from "vitest";
import { parseCedula } from "./cedula";

describe("parseCedula", () => {
  it("acepta V con guión y normaliza (case-insensitive)", () => {
    const r = parseCedula("v-12345678");
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ tipo: "V", numero: 12345678, formatted: "V-12345678" });
  });

  it("acepta E sin guión", () => {
    expect(parseCedula("E1234567").valid).toBe(true);
  });

  it("acepta separadores de miles (V-28.252.900)", () => {
    const r = parseCedula("V-28.252.900");
    expect(r.valid).toBe(true);
    expect(r.data?.numero).toBe(28252900);
    expect(r.data?.formatted).toBe("V-28252900");
  });

  it("rechaza sin prefijo de nacionalidad", () => {
    expect(parseCedula("12345678").valid).toBe(false);
  });

  it("rechaza número fuera de rango", () => {
    expect(parseCedula("V-99").valid).toBe(false);
  });

  it("rechaza nacionalidad inválida", () => {
    expect(parseCedula("X-12345678").valid).toBe(false);
  });
});
