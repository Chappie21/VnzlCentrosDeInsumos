import { describe, it, expect, afterEach, vi } from "vitest";
import { paisPorTimezone } from "./pais";

function conTimezone(timeZone: string) {
  vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as any);
}

afterEach(() => vi.restoreAllMocks());

describe("paisPorTimezone", () => {
  it("detecta Colombia y Venezuela", () => {
    conTimezone("America/Bogota");
    expect(paisPorTimezone()).toBe("CO");
    conTimezone("America/Caracas");
    expect(paisPorTimezone()).toBe("VE");
  });

  it("cae a VE con cualquier otra zona", () => {
    conTimezone("Europe/Madrid");
    expect(paisPorTimezone()).toBe("VE");
    conTimezone("UTC"); // lo que devuelve el render en el servidor
    expect(paisPorTimezone()).toBe("VE");
  });

  it("cae a VE si Intl lanza", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("sin Intl");
    });
    expect(paisPorTimezone()).toBe("VE");
  });
});
