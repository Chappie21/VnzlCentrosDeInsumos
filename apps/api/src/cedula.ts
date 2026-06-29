import * as https from "https";
import { Injectable } from "@nestjs/common";
import { prisma } from "@vnzl/database";
import { parseCedula } from "@vnzl/venezuela";

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

  // Valida la cédula de un usuario UNA sola vez y cachea el resultado en Usuario
  // (CEN-23). Best-effort, fire-and-forget e idempotente: no bloquea el flujo.
  // Sentinel "ya intentada" = `cedulaVerificadaEn` (timestamp). null = pendiente;
  // si la API responde null (caída/sin config) no se escribe → se reintenta luego.
  async validarYGuardar(userId: string): Promise<void> {
    try {
      const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { cedula: true, cedulaVerificadaEn: true },
      });
      if (!u?.cedula || u.cedulaVerificadaEn != null) return; // ya intentada o sin cédula
      const parsed = parseCedula(u.cedula);
      if (!parsed.valid || !parsed.data) return;
      const r = await this.verificar(parsed.data.tipo, parsed.data.numero);
      if (!r) return; // API caída/sin config → reintenta en el próximo trigger
      await prisma.usuario.update({
        where: { id: userId },
        data: { cedulaVerificada: r.existe, cedulaNombre: r.nombre, cedulaVerificadaEn: new Date() },
      });
    } catch {
      /* best-effort */
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
