import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { VoluntarioGuard } from "./guards";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    voluntario: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
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
  await expect(g.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
});

it("VoluntarioGuard permite al voluntario del centro (positive path)", async () => {
  const token = await new JwtService({ secret: "test-secret" }).signAsync({ sub: "user-x", typ: "user" });
  prismaMock.voluntario.findUnique.mockResolvedValue({ usuarioId: "user-x", centroId: "c1" });

  const context = ctx({ authorization: `Bearer ${token}` }, { centroId: "c1" });
  const g = new VoluntarioGuard(jwt);

  await expect(g.canActivate(context)).resolves.toBe(true);
  expect(context._req.userId).toBe("user-x");
});
