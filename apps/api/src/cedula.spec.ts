import { describe, it, expect } from "vitest";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { CedulaService, interpretarRespuesta } from "./cedula";

// Construye un CedulaService con `verificar` stubeado (sin red).
function withVerificar(result: any) {
  const s = new CedulaService();
  (s as any).verificar = async () => result;
  return s;
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

describe("CedulaService.validarParaRegistro", () => {
  it("rechaza un formato de cédula inválido", async () => {
    await expect(withVerificar(null).validarParaRegistro("xx", "Juan")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("fail-open CON nombre de respaldo (Google): deja pasar, no verificado", async () => {
    const r = await withVerificar(null).validarParaRegistro("V12345678", "Juan Perez");
    expect(r).toEqual({ nombre: "Juan Perez", cedulaVerificada: null, cedulaNombre: null });
  });

  it("SIN respaldo y API caída (null): lanza 503 (no registra)", async () => {
    await expect(
      withVerificar(null).validarParaRegistro("V12345678"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rechaza si la cédula no corresponde a una persona real", async () => {
    await expect(
      withVerificar({ existe: false, nombre: null }).validarParaRegistro("V12345678", "Juan"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("usa el nombre OFICIAL del registro cuando la cédula existe", async () => {
    const r = await withVerificar({ existe: true, nombre: "MARIA OFICIAL PEREZ" }).validarParaRegistro(
      "V12345678",
      "maria",
    );
    expect(r).toEqual({
      nombre: "MARIA OFICIAL PEREZ",
      cedulaVerificada: true,
      cedulaNombre: "MARIA OFICIAL PEREZ",
    });
  });
});
