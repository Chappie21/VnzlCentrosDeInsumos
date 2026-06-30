import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, compare } from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@vnzl/database";
import { signUserToken } from "./jwt-session";
import { normalizarCedula, normalizarTelefono } from "../usuarios";
import { CedulaService } from "../cedula";
import { RegisterDto, LoginDto } from "./dto";

@Injectable()
export class AuthService {
  // ponytail: cliente real en runtime, mock en test
  private googleClient: Pick<OAuth2Client, "verifyIdToken"> = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly jwt: JwtService,
    private readonly cedula: CedulaService,
  ) {}

  async register(dto: RegisterDto) {
    const cedula = normalizarCedula(dto.cedula);
    const telefono = normalizarTelefono(dto.telefono);
    const existe = await prisma.usuario.findUnique({ where: { cedula } });
    if (existe) throw new ConflictException("Ya existe una cuenta con esa cédula");
    // Portón: la cédula debe ser de una persona real. El nombre sale del registro
    // oficial (sin respaldo → si la API no responde, lanza 503).
    const v = await this.cedula.validarParaRegistro(cedula);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: v.nombre,
        cedula,
        telefono,
        passwordHash: await hash(dto.password, 10),
        cedulaVerificada: v.cedulaVerificada,
        cedulaNombre: v.cedulaNombre,
        cedulaVerificadaEn: v.cedulaVerificada ? new Date() : null,
      },
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

  async google(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken, audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new UnauthorizedException("Token de Google inválido");

    let usuario = await prisma.usuario.findUnique({ where: { googleId: p.sub } });
    if (!usuario) {
      // enlazar por email si ya existía cuenta con ese email, si no crear
      usuario = await prisma.usuario.upsert({
        where: { email: p.email },
        update: { googleId: p.sub },
        create: { googleId: p.sub, email: p.email, nombre: p.name ?? null },
      });
    }
    const u = this.publico(usuario);
    return { token: await signUserToken(this.jwt, usuario.id), usuario: u, needsProfile: !u.identidadCompleta };
  }

  private publico(u: any) {
    return {
      id: u.id, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono,
      identidadCompleta: Boolean(u.nombre && u.cedula && u.telefono),
    };
  }
}
