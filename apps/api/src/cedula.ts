import * as https from "https";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "@vnzl/database";
import { parseDocumento, type Pais } from "@vnzl/paises";
import { cedulaValidacionVe } from "./feature-flags";

// Portón de verificación contra el registro civil. ENCENDIDO por defecto; se
// apaga desde el feature flag `cedula-validacion-ve` de Railway, en caliente y
// sin redeploy (p. ej. si api.cedula.com.ve se cae o empieza a cobrar).
//
// Cuando está activo, el nombre sale del registro oficial y NO se teclea. Por eso
// esta misma función decide si el formulario tiene que pedir el nombre: si acá
// devuelve false, el nombre pasa a ser obligatorio en el body. El frontend lee
// este mismo valor por GET /config/flags — una sola verdad, un solo interruptor.
//
// api.cedula.com.ve es SOLO venezolana y Colombia no tiene un equivalente
// gratuito, así que CO nunca pasa por acá y siempre teclea su nombre.
export function validacionActiva(pais: Pais): boolean {
  return pais === "VE" && cedulaValidacionVe();
}

// Resultado del portón de registro: nombre a usar + estado de verificación.
export type ValidacionRegistro = {
  nombre: string | null; // oficial si se verificó, tecleado si fail-open
  cedulaVerificada: boolean | null; // true=real, null=no se pudo consultar (fail-open)
  cedulaNombre: string | null; // nombre oficial del registro (si se verificó)
};

type CedulaData = {
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
};

export type CedulaResultado = { existe: boolean; nombre: string | null };

// Nombre completo a partir de los campos de la API.
export function construirNombre(d: CedulaData): string {
  return [
    d.primer_nombre,
    d.segundo_nombre,
    d.primer_apellido,
    d.segundo_apellido,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

// Interpreta el body de api.cedula.com.ve: data presente → la cédula existe.
export function interpretarRespuesta(body: any): CedulaResultado {
  if (body && body.error === false && body.data) {
    return { existe: true, nombre: construirNombre(body.data) || null };
  }
  return { existe: false, nombre: null };
}

@Injectable()
export class CedulaService {
  // Portón de registro: valida el documento contra el registro real y toma de ahí
  // el NOMBRE OFICIAL (que pisa al tecleado cuando la API responde).
  // - Formato inválido → 400 (siempre, es sanidad de input y no depende del flag).
  // - Flag apagado / país sin API de verificación → se salta la consulta.
  // - Documento que NO corresponde a una persona real → 400.
  // - API caída / sin configurar:
  //     · con `nombreRespaldo` → fail-open (deja pasar, marca no verificado).
  //     · sin respaldo → 503: no se puede registrar sin poder verificar.
  async validarParaRegistro(
    pais: Pais,
    cedula: string,
    nombreRespaldo?: string,
  ): Promise<ValidacionRegistro> {
    const parsed = parseDocumento(pais, cedula);
    if (!parsed.valid || !parsed.data) {
      throw new BadRequestException("Documento de identidad inválido");
    }
    if (!validacionActiva(pais) || !parsed.data.tipo) {
      // Sin registro que consultar, el nombre tecleado es la única fuente. Que
      // falte acá significa que el formulario no lo pidió cuando debía: cortar
      // en vez de crear una cuenta sin nombre (identidad incompleta = el usuario
      // no puede crear centros ni aceptar invitaciones, y falla en silencio).
      const respaldo = nombreRespaldo?.trim();
      if (!respaldo) throw new BadRequestException("El nombre es obligatorio");
      return { nombre: respaldo, cedulaVerificada: null, cedulaNombre: null };
    }
    const r = await this.verificar(parsed.data.tipo, parsed.data.numero);
    if (r === null) {
      const respaldo = nombreRespaldo?.trim();
      if (respaldo) {
        return { nombre: respaldo, cedulaVerificada: null, cedulaNombre: null };
      }
      throw new ServiceUnavailableException(
        "No pudimos verificar tu cédula en este momento. Intenta de nuevo en un momento.",
      );
    }
    if (!r.existe) {
      throw new BadRequestException(
        "La cédula no corresponde a una persona real. Verifica el número.",
      );
    }
    return {
      nombre: r.nombre || nombreRespaldo?.trim() || null,
      cedulaVerificada: true,
      cedulaNombre: r.nombre,
    };
  }

  // Resultado, o null si no se pudo consultar (sin config / API caída / timeout).
  async verificar(
    nacionalidad: "V" | "E",
    numero: number,
  ): Promise<CedulaResultado | null> {
    const appId = process.env.APP_ID_CEDULA;
    const token = process.env.TOKEN_CEDULA;
    if (!appId || !token || appId === "REEMPLAZAR") return null; // no configurada
    const url =
      `https://api.cedula.com.ve/api/v1?app_id=${encodeURIComponent(appId)}` +
      `&token=${encodeURIComponent(token)}&nacionalidad=${nacionalidad}&cedula=${numero}`;
    try {
      return interpretarRespuesta(await this.getJson(url));
    } catch {
      return null;
    }
  }

  // Valida la cédula de un usuario UNA sola vez y cachea el resultado en Usuario
  // (CEN-23). Best-effort, fire-and-forget e idempotente: no bloquea el flujo.
  // Sentinel "ya intentada" = `cedulaVerificadaEn` (timestamp). null = pendiente;
  // si la API responde null (caída/sin config) no se escribe → se reintenta luego.
  async validarYGuardar(userId: string): Promise<void> {
    try {
      const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { cedula: true, pais: true, cedulaVerificadaEn: true },
      });
      if (!u?.cedula || u.cedulaVerificadaEn != null) return; // ya intentada o sin cédula
      if (!validacionActiva(u.pais)) return; // flag apagado o país sin API de verificación
      const parsed = parseDocumento(u.pais, u.cedula);
      if (!parsed.valid || !parsed.data?.tipo) return;
      const r = await this.verificar(parsed.data.tipo, parsed.data.numero);
      if (!r) return; // API caída/sin config → reintenta en el próximo trigger
      await prisma.usuario.update({
        where: { id: userId },
        data: {
          cedulaVerificada: r.existe,
          cedulaNombre: r.nombre,
          cedulaVerificadaEn: new Date(),
        },
      });
    } catch {
      /* best-effort */
    }
  }

  // GET JSON con TLS relajado (la API tiene cert inválido) + timeout.
  // ponytail: rejectUnauthorized:false es inseguro (MITM) pero la API lo exige.
  private getJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        { rejectUnauthorized: false, timeout: 10_000 },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (!res.statusCode || res.statusCode >= 400)
              return reject(new Error(`HTTP ${res.statusCode}`));
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
    });
  }
}
