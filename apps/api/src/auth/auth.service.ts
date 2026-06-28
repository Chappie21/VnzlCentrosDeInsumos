import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, compare } from "bcryptjs";
import { prisma } from "@vnzl/database";
import { signUserToken } from "./jwt-session";
import { normalizarCedula, normalizarTelefono } from "../usuarios";
import { RegisterDto, LoginDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const cedula = normalizarCedula(dto.cedula);
    const telefono = normalizarTelefono(dto.telefono);
    const existe = await prisma.usuario.findUnique({ where: { cedula } });
    if (existe) throw new ConflictException("Ya existe una cuenta con esa cédula");
    const usuario = await prisma.usuario.create({
      data: { nombre: dto.nombre.trim(), cedula, telefono, passwordHash: await hash(dto.password, 10) },
    });
    return { token: await signUserToken(this.jwt, usuario.id), usuario: this.publico(usuario) };
  }

  async login(dto: LoginDto) {
    const cedula = normalizarCedula(dto.cedula);
    const usuario = await prisma.usuario.findUnique({ where: { cedula } });
    if (!usuario?.passwordHash || !(await compare(dto.password, usuario.passwordHash)))
      throw new UnauthorizedException("Cédula o contraseña inválida");
    return { token: await signUserToken(this.jwt, usuario.id), usuario: this.publico(usuario) };
  }

  private publico(u: any) {
    return {
      id: u.id, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono,
      identidadCompleta: Boolean(u.nombre && u.cedula && u.telefono),
    };
  }
}
