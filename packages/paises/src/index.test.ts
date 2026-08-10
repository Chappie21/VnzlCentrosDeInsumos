import { describe, it, expect } from "vitest";
import { estadosDe, ciudadesDe, esEstadoValido, esCiudadValida, esPaisValido } from "./index";

describe("divisiones administrativas", () => {
  it("carga los dos datasets", () => {
    expect(estadosDe("VE")).toHaveLength(24);
    expect(estadosDe("CO")).toHaveLength(33);
  });

  it("resuelve ciudades conocidas", () => {
    expect(ciudadesDe("CO", "Antioquia")).toContain("Medellín");
    expect(ciudadesDe("CO", "Bogotá D.C.")).toEqual(["Bogotá D.C."]);
    expect(ciudadesDe("VE", "Miranda")).toContain("Chacao");
  });

  it("devuelve vacío para un estado inexistente", () => {
    expect(ciudadesDe("CO", "Miranda")).toEqual([]);
  });

  // Lo que impide que un centro colombiano se guarde con un estado venezolano.
  it("aísla los países entre sí", () => {
    expect(esEstadoValido("CO", "Miranda")).toBe(false);
    expect(esEstadoValido("VE", "Antioquia")).toBe(false);
    expect(esCiudadValida("VE", "Zulia", "Medellín")).toBe(false);
    expect(esCiudadValida("CO", "Antioquia", "Medellín")).toBe(true);
  });

  it("Bogotá ya no cuelga de Cundinamarca", () => {
    expect(ciudadesDe("CO", "Cundinamarca")).not.toContain("Bogotá");
  });
});

describe("esPaisValido", () => {
  it("acepta los soportados y rechaza el resto", () => {
    expect(esPaisValido("VE")).toBe(true);
    expect(esPaisValido("CO")).toBe(true);
    expect(esPaisValido("AR")).toBe(false);
    expect(esPaisValido(undefined)).toBe(false);
  });
});
