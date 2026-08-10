import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, compare } from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@vnzl/database";
import { signUserToken } from "./jwt-session";
import { normalizarDocumento, normalizarTelefono } from "@vnzl/paises";
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
    const cedula = normalizarDocumento(dto.pais, dto.cedula);
    const telefono = normalizarTelefono(dto.telefono);
    const existe = await prisma.usuario.findUnique({ where: { cedula } });
    if (existe) throw new ConflictException("Ya existe una cuenta con ese documento");
    // Portón (activo en Venezuela): el documento debe ser de una persona real y
    // el nombre sale del registro oficial. En Colombia no hay registro que
    // consultar, así que vale el nombre tecleado.
    const v = await this.cedula.validarParaRegistro(dto.pais, cedula, dto.nombre);
    const usuario = await prisma.usuario.create({
      data: {
        pais: dto.pais,
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
    const usuario = await this.porDocumento(dto.cedula);
    if (!usuario?.passwordHash || !(await compare(dto.password, usuario.passwordHash)))
      throw new UnauthorizedException("Documento o contraseña inválida");
    return { token: await signUserToken(this.jwt, usuario.id), usuario: this.publico(usuario) };
  }

  // ponytail: el login no sabe el país (no se pide, para no meter fricción en el
  // flujo más caliente). Se busca el documento tal cual y, si no aparece y son
  // puros dígitos, se reintenta con el prefijo "V" implícito de Venezuela — que
  // es como quedaron guardados todos los usuarios previos a Colombia.
  // Dos findUnique en el peor caso; el login no es hot path.
  private async porDocumento(raw: string) {
    const v = raw.toUpperCase().replace(/[.\s-]/g, "");
    return (
      (await prisma.usuario.findUnique({ where: { cedula: v } })) ??
      (/^\d+$/.test(v) ? await prisma.usuario.findUnique({ where: { cedula: "V" + v } }) : null)
    );
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
      id: u.id, pais: u.pais, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono,
      identidadCompleta: Boolean(u.nombre && u.cedula && u.telefono),
    };
  }
}
