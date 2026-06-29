import { describe, it, expect } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { signUserToken, verifyUserToken } from "./jwt-session";

const jwt = new JwtService({ secret: "test-secret" });

describe("jwt-session", () => {
  it("firma y verifica un token de usuario", async () => {
    const t = await signUserToken(jwt, "user-123");
    expect(await verifyUserToken(jwt, t)).toBe("user-123");
  });

  it("rechaza un token con typ distinto de user", async () => {
    const invite = await jwt.signAsync({ centroId: "c1", typ: "invite" });
    await expect(verifyUserToken(jwt, invite)).rejects.toThrow();
  });
});
