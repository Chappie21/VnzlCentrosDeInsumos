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

// Login de moderadores (opción C). email + password (bcrypt) → sesión JWT 8h.
// Da identidad por persona (accountability) y revocación (activo=false).
// DUMMY_HASH to prevent user enumeration via timing attacks
// Computed via: bcrypt.hashSync("dummy", 10)
const DUMMY_HASH = "$2b$10$m6K96UBLX4nd14PGJJynu.YPfkO2b82hgcKrJIbMJUCGvC2sUnP3u";

@Injectable()
export class AdminService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<{ token: string; nombre: string }> {
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Evaluate compare to prevent timing attacks
    const hash = admin?.passwordHash || DUMMY_HASH;
    const isValidPassword = await compare(password, hash);

    // Mismo error siempre (no filtrar si el email existe).
    if (!admin || !admin.activo || !isValidPassword)
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
