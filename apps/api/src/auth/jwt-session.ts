import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";

const USER_TTL = "30d";

export function signUserToken(jwt: JwtService, userId: string): Promise<string> {
  return jwt.signAsync({ sub: userId, typ: "user" }, { expiresIn: USER_TTL });
}

export async function verifyUserToken(jwt: JwtService, token: string): Promise<string> {
  let payload: any;
  try {
    payload = await jwt.verifyAsync(token);
  } catch {
    throw new UnauthorizedException("Sesión inválida o expirada");
  }
  if (payload?.typ !== "user" || !payload?.sub)
    throw new UnauthorizedException("No es una sesión de usuario");
  return payload.sub;
}
