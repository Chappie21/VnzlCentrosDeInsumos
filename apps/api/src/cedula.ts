import * as https from "https";
import { BadRequestException, Injectable } from "@nestjs/common";
import { parseCedula } from "@vnzl/venezuela";

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
  return [d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido]
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
  // Portón de registro: valida la cédula contra el registro real.
  // - Formato inválido → 400.
  // - Cédula que NO corresponde a una persona real → 400 (no se puede registrar).
  // - API caída / sin configurar → fail-open: deja pasar, marca no verificado (null).
  // Si se verifica, devuelve el NOMBRE OFICIAL (decisión: ignorar el tecleado).
  async validarParaRegistro(
    cedula: string,
    nombreTecleado?: string,
  ): Promise<ValidacionRegistro> {
    const parsed = parseCedula(cedula);
    if (!parsed.valid || !parsed.data) {
      throw new BadRequestException("Cédula inválida");
    }
    const r = await this.verificar(parsed.data.tipo, parsed.data.numero);
    if (r === null) {
      // fail-open: no se pudo consultar ahora
      return { nombre: nombreTecleado?.trim() || null, cedulaVerificada: null, cedulaNombre: null };
    }
    if (!r.existe) {
      throw new BadRequestException(
        "La cédula no corresponde a una persona real. Verifica el número.",
      );
    }
    return {
      nombre: r.nombre || nombreTecleado?.trim() || null,
      cedulaVerificada: true,
      cedulaNombre: r.nombre,
    };
  }

  // Resultado, o null si no se pudo consultar (sin config / API caída / timeout).
  async verificar(nacionalidad: "V" | "E", numero: number): Promise<CedulaResultado | null> {
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

  // GET JSON con TLS relajado (la API tiene cert inválido) + timeout.
  // ponytail: rejectUnauthorized:false es inseguro (MITM) pero la API lo exige.
  private getJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { rejectUnauthorized: false, timeout: 10_000 }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
    });
  }
}
