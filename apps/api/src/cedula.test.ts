import { describe, it, expect } from "vitest";
import { construirNombre, interpretarRespuesta } from "./cedula";

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
