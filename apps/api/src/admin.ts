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

// Constant dummy hash to prevent user enumeration via timing attacks
const DUMMY_HASH = "$2b$10$o6JbEGJrC0mQdd8zjUWp9eLKe.gNademG2ZMZzUwOwpMzcm3xxFqq";

// Login de moderadores (opción C). email + password (bcrypt) → sesión JWT 8h.
// Da identidad por persona (accountability) y revocación (activo=false).
@Injectable()
export class AdminService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<{ token: string; nombre: string }> {
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Execute compare regardless of whether user exists to prevent timing attack enumeration
    const isPasswordValid = await compare(password, admin?.passwordHash || DUMMY_HASH);

    // Mismo error siempre (no filtrar si el email existe).
    if (!admin || !admin.activo || !isPasswordValid)
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
