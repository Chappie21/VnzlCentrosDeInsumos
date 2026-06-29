import { describe, it, expect, beforeEach } from "vitest";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

// ---------- prisma mock (vi.hoisted pattern matching repo conventions) ----------
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@vnzl/database", () => ({
  prisma: prismaMock,
  NivelInsumo: { URGENTE: "URGENTE", NORMAL: "NORMAL", SUFICIENTE: "SUFICIENTE" },
  RolVoluntario: { JEFE: "JEFE", VOLUNTARIO: "VOLUNTARIO" },
  CategoriaInsumo: {},
  Prisma: {},
}));

// ---------- imports after mock ----------
import { AuthService } from "./auth.service";
import { verifyUserToken } from "./jwt-session";

const jwt = new JwtService({ secret: "test-secret" });
const cedula = { validarYGuardar: vi.fn().mockResolvedValue(undefined) } as any;
const service = new AuthService(jwt, cedula);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe("AuthService.register", () => {
  it("hashea la contraseña, crea el usuario y devuelve un token verificable", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: "user-uuid-1",
      nombre: "John Doe",
      cedula: "V12345678",
      telefono: "04141234567",
      passwordHash: "will-be-checked-below",
    };
    prismaMock.usuario.create.mockResolvedValue(createdUser);

    const res = await service.register({
      nombre: "John Doe",
      cedula: "V12345678",
      telefono: "04141234567",
      password: "securepassword",
    });

    // passwordHash must be the bcrypt hash, not plaintext
    const createArg = prismaMock.usuario.create.mock.calls[0][0];
    expect(createArg.data.passwordHash).toBeDefined();
    expect(createArg.data.passwordHash).not.toBe("securepassword");
    expect(createArg.data.passwordHash).toMatch(/^\$2[ab]\$/); // bcrypt prefix

    // token must resolve to the created user's id
    expect(res.token).toBeDefined();
    const userId = await verifyUserToken(jwt, res.token);
    expect(userId).toBe("user-uuid-1");

    // usuario shape
    expect(res.usuario).toMatchObject({
      id: "user-uuid-1",
      nombre: "John Doe",
      cedula: "V12345678",
      telefono: "04141234567",
    });
    expect(res.usuario).toHaveProperty("identidadCompleta");

    // CEN-23: el registro dispara la validación de cédula (fire-and-forget)
    expect(cedula.validarYGuardar).toHaveBeenCalledWith("user-uuid-1");
  });

  it("lanza ConflictException si la cédula ya existe", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      service.register({
        nombre: "Jane Doe",
        cedula: "V12345678",
        telefono: "04141234567",
        password: "securepassword",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe("AuthService.login", () => {
  it("devuelve token válido con contraseña correcta", async () => {
    const { hash } = await import("bcryptjs");
    const passwordHash = await hash("mypassword", 10);

    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "user-uuid-2",
      nombre: "Ana García",
      cedula: "E87654321",
      telefono: "04261234567",
      passwordHash,
    });

    const res = await service.login({ cedula: "E87654321", password: "mypassword" });

    expect(res.token).toBeDefined();
    const userId = await verifyUserToken(jwt, res.token);
    expect(userId).toBe("user-uuid-2");

    expect(res.usuario).toMatchObject({ id: "user-uuid-2", cedula: "E87654321" });
  });

  it("lanza UnauthorizedException con contraseña incorrecta", async () => {
    const { hash } = await import("bcryptjs");
    const passwordHash = await hash("correctpassword", 10);

    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "user-uuid-2",
      passwordHash,
    });

    await expect(
      service.login({ cedula: "E87654321", password: "wrongpassword" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lanza UnauthorizedException si el usuario no existe", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ cedula: "V00000000", password: "any" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lanza UnauthorizedException si el usuario no tiene passwordHash (google-only)", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "google-only-user",
      nombre: "Google User",
      cedula: "V11111111",
      passwordHash: null,
    });

    await expect(
      service.login({ cedula: "V11111111", password: "anypassword" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// google
// ---------------------------------------------------------------------------
describe("AuthService.google", () => {
  const fakePayload = { sub: "g1", email: "a@b.com", name: "Ana" };
  const fakeTicket = { getPayload: () => fakePayload };
  const fakeVerifier = { verifyIdToken: async () => fakeTicket };

  beforeEach(() => {
    // ponytail: cliente real en runtime, mock en test
    (service as any)["googleClient"] = fakeVerifier;
  });

  it("crea un nuevo usuario con googleId y devuelve needsProfile:true (sin cédula)", async () => {
    const newUser = {
      id: "user-google-1",
      nombre: "Ana",
      cedula: null,
      telefono: null,
      googleId: "g1",
      email: "a@b.com",
    };
    prismaMock.usuario.findUnique.mockResolvedValue(null); // no existe por googleId
    prismaMock.usuario.upsert.mockResolvedValue(newUser);

    const res = await service.google("fake-id-token");

    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({ where: { googleId: "g1" } });
    expect(prismaMock.usuario.upsert).toHaveBeenCalledWith({
      where: { email: "a@b.com" },
      update: { googleId: "g1" },
      create: { googleId: "g1", email: "a@b.com", nombre: "Ana" },
    });
    expect(res.needsProfile).toBe(true);
    expect(res.usuario).toMatchObject({ id: "user-google-1", nombre: "Ana" });
    expect(res.token).toBeDefined();
  });

  it("reutiliza el usuario existente por googleId sin crear duplicado", async () => {
    const existingUser = {
      id: "user-google-1",
      nombre: "Ana",
      cedula: null,
      telefono: null,
      googleId: "g1",
      email: "a@b.com",
    };
    prismaMock.usuario.findUnique.mockResolvedValue(existingUser); // ya existe

    const res = await service.google("fake-id-token");

    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({ where: { googleId: "g1" } });
    expect(prismaMock.usuario.upsert).not.toHaveBeenCalled();
    expect(res.needsProfile).toBe(true);
    expect(res.usuario.id).toBe("user-google-1");
  });

  it("lanza UnauthorizedException si el token no tiene sub", async () => {
    (service as any)["googleClient"] = {
      verifyIdToken: async () => ({ getPayload: () => ({ email: "a@b.com" }) }),
    };

    await expect(service.google("bad-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
