import {
  Body,
  Controller,
  Injectable,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { prisma } from "@vnzl/database";
import { RateLimitGuard } from "./guards";

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

// Pre-computed bcrypt hash for "dummy" with cost factor 10 to prevent timing attacks.
// Used to normalize execution time of bcrypt.compare when a user is not found.
const DUMMY_HASH = "$2b$10$PHALslj6T/12PmChUOgMmOURjaf44nw06.i1UiiLQfuNgP/yad9v6";

// Login de moderadores (opción C). email + password (bcrypt) → sesión JWT 8h.
// Da identidad por persona (accountability) y revocación (activo=false).
@Injectable()
export class AdminService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<{ token: string; nombre: string }> {
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Mitigate timing attack: always run bcrypt.compare even if admin doesn't exist or is inactive
    const hashToCompare = admin?.passwordHash || DUMMY_HASH;
    const isMatch = await compare(password, hashToCompare);

    // Mismo error siempre (no filtrar si el email existe).
    if (!admin || !admin.activo || !isMatch)
      throw new UnauthorizedException("Credenciales inválidas");
    const token = await this.jwt.signAsync({ sub: admin.id, typ: "admin" }, { expiresIn: "8h" });
    return { token, nombre: admin.nombre };
  }
}

@Controller("admin")
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // Rate-limited para frenar fuerza bruta.
  @Post("login")
  @UseGuards(RateLimitGuard)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto.email, dto.password);
  }
}
