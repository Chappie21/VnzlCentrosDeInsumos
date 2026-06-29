import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Captura el send de Resend para inspeccionarlo. La instancia se construye fresca en cada
// test (el cliente se arma en un campo de clase leyendo process.env.RESEND_API_KEY).
const { sendMock, findManyMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock("@vnzl/database", () => ({
  prisma: { admin: { findMany: findManyMock } },
}));

import { EmailService } from "./email.service";

const centro = {
  nombre: "Centro Pruebas",
  estado: "Miranda",
  ciudad: "Los Teques",
  direccion: "Av. Bolívar 123",
  creadoEn: new Date("2026-06-29"),
};

describe("EmailService.notificarCentroNuevo", () => {
  const ENV = process.env;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ENV };
    findManyMock.mockResolvedValue([{ email: "a@x.com" }, { email: "b@x.com" }]);
    sendMock.mockResolvedValue({ data: { id: "1" }, error: null });
  });
  afterEach(() => {
    process.env = ENV;
  });

  it("no envía nada si falta RESEND_API_KEY (dev local)", async () => {
    delete process.env.RESEND_API_KEY;
    await new EmailService().notificarCentroNuevo(centro);
    expect(sendMock).not.toHaveBeenCalled();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("envía a los admins activos con asunto, html y link de moderación", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.WEB_ORIGIN = "https://app.test";
    await new EmailService().notificarCentroNuevo(centro);

    expect(findManyMock).toHaveBeenCalledWith({ where: { activo: true }, select: { email: true } });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toEqual(["a@x.com", "b@x.com"]);
    expect(arg.subject).toContain("Centro Pruebas");
    expect(arg.html).toContain("Centro Pruebas");
    expect(arg.html).toContain("https://app.test/moderacion");
  });

  it("no envía si no hay admins activos", async () => {
    process.env.RESEND_API_KEY = "re_test";
    findManyMock.mockResolvedValue([]);
    await new EmailService().notificarCentroNuevo(centro);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no propaga si el envío falla (best-effort)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(new EmailService().notificarCentroNuevo(centro)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
