import { Injectable } from "@nestjs/common";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { prisma } from "@vnzl/database";
import { CentroNuevoEmail } from "./emails/CentroNuevoEmail";

// Envío de correos transaccionales (Resend). Espeja el patrón de RedisService: cliente
// como campo de clase desde process.env, registrado como provider en AppModule.
// Sin RESEND_API_KEY (dev local) hace no-op silencioso.
@Injectable()
export class EmailService {
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  // Avisa a los moderadores activos de un centro recién creado. Fire-and-forget desde el
  // caller (void): nunca debe tumbar la creación del centro.
  async notificarCentroNuevo(centro: {
    nombre: string;
    estado: string;
    ciudad: string;
    direccion: string;
    creadoEn: Date | string;
  }): Promise<void> {
    if (!this.resend) return; // dev local sin clave
    const admins = await prisma.admin.findMany({
      where: { activo: true },
      select: { email: true },
    });
    if (admins.length === 0) return;

    // WEB_ORIGIN puede ser coma-separado (lista CORS); el link usa el primer origen.
    const origin = (process.env.WEB_ORIGIN || "").split(",")[0].trim() || "http://localhost:3000";
    const moderacionUrl = `${origin}/moderacion`;
    const html = await render(
      CentroNuevoEmail({
        nombre: centro.nombre,
        estado: centro.estado,
        ciudad: centro.ciudad,
        direccion: centro.direccion,
        creadoEn: centro.creadoEn,
        moderacionUrl,
      }),
    );

    try {
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM || "Red Acopio Venezuela <onboarding@resend.dev>",
        to: admins.map((a) => a.email),
        subject: `Nuevo centro de acopio por verificar: ${centro.nombre}`,
        html,
      });
    } catch (e) {
      // ponytail: el correo es best-effort; loguear y seguir, nunca tumbar la request.
      console.error("[email] fallo al notificar centro nuevo", e);
    }
  }
}
