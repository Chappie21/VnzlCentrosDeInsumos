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

const DUMMY_HASH = "$2b$10$qtE/XQYFBj/GyC3oj2BFQeOG1ovwV/glZ7k.0PbisSWeAdVzKFRXG";

// Login de moderadores (opción C). email + password (bcrypt) → sesión JWT 8h.
// Da identidad por persona (accountability) y revocación (activo=false).
@Injectable()
export class AdminService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<{ token: string; nombre: string }> {
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Mismo error siempre (no filtrar si el email existe).
    // Mitigate timing attacks by always performing a bcrypt comparison
    if (!admin || !admin.activo) {
      await compare(password, DUMMY_HASH);
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (!(await compare(password, admin.passwordHash))) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

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
