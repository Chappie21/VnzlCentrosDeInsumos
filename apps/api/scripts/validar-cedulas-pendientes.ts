import "dotenv/config";
import "reflect-metadata";
import { prisma } from "@vnzl/database";
import { parseCedula } from "@vnzl/venezuela";
import { CedulaService } from "../src/cedula";

// One-off de prueba: valida las cédulas de usuarios aún no chequeados (reusa el
// servicio real → pega a api.cedula.com.ve). Útil para probar sin crear centros.
async function main() {
  const svc = new CedulaService();
  const usuarios = await prisma.usuario.findMany({
    where: { cedula: { not: null }, cedulaVerificada: null },
    select: { fingerprint: true, nombre: true, cedula: true },
  });
  console.log(`usuarios a validar: ${usuarios.length}`);
  for (const u of usuarios) {
    const p = parseCedula(u.cedula!);
    if (!p.valid || !p.data) {
      console.log(`- ${u.nombre} (${u.cedula}): formato inválido, skip`);
      continue;
    }
    const r = await svc.verificar(p.data.tipo, p.data.numero);
    console.log(`- ${u.nombre} (${u.cedula}) →`, r);
    if (r) {
      await prisma.usuario.update({
        where: { fingerprint: u.fingerprint },
        data: { cedulaVerificada: r.existe, cedulaNombre: r.nombre, cedulaVerificadaEn: new Date() },
      });
    }
  }
  await prisma.$disconnect();
}

main();
