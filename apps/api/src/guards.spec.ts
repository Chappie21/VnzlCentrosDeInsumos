import { JwtService } from "@nestjs/jwt";
import { VoluntarioGuard } from "./guards";

vi.mock("@vnzl/database", () => ({
  prisma: {
    voluntario: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
  },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
  NivelInsumo: {},
  CategoriaInsumo: {},
}));

const jwt = new JwtService({ secret: "test-secret" });
function ctx(headers: Record<string, string>, body: any = {}) {
  const req: any = { headers, body, header: (h: string) => headers[h.toLowerCase()] };
  return { switchToHttp: () => ({ getRequest: () => req }), _req: req } as any;
}

it("VoluntarioGuard rechaza sin Bearer", async () => {
  const g = new VoluntarioGuard(jwt);
  await expect(g.canActivate(ctx({}))).rejects.toThrow();
});
