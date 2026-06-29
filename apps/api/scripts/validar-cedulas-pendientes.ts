import "dotenv/config";
import "reflect-metadata";
import { prisma } from "@vnzl/database";
import { CedulaService } from "../src/cedula";

// One-off de prueba: valida las cédulas de usuarios aún no intentados (reusa el
// servicio real → pega a api.cedula.com.ve). Útil para probar sin crear centros.
// Sentinel "pendiente" = cedulaVerificadaEn null (nunca se intentó).
async function main() {
  const svc = new CedulaService();
  const usuarios = await prisma.usuario.findMany({
    where: { cedula: { not: null }, cedulaVerificadaEn: null },
    select: { id: true, nombre: true, cedula: true },
  });
  console.log(`usuarios a validar: ${usuarios.length}`);
  for (const u of usuarios) {
    await svc.validarYGuardar(u.id);
    const after = await prisma.usuario.findUnique({
      where: { id: u.id },
      select: { cedulaVerificada: true, cedulaNombre: true, cedulaVerificadaEn: true },
    });
    console.log(`- ${u.nombre} (${u.cedula}) →`, after);
  }
  await prisma.$disconnect();
}

main();
