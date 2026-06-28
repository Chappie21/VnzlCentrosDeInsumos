import "dotenv/config";
import { prisma } from "@vnzl/database";
import { hash } from "bcryptjs";

// Crea/actualiza un moderador. Uso:
//   pnpm --filter @vnzl/api exec tsx scripts/seed-admin.ts <email> <password> <nombre>
async function main() {
  const [email, password, ...nombreParts] = process.argv.slice(2);
  const nombre = nombreParts.join(" ").trim();
  if (!email || !password) {
    console.error("Uso: tsx scripts/seed-admin.ts <email> <password> <nombre>");
    process.exit(1);
  }
  const passwordHash = await hash(password, 10);
  const admin = await prisma.admin.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), passwordHash, nombre: nombre || email },
    update: { passwordHash, nombre: nombre || email, activo: true },
  });
  console.log("Admin listo:", admin.email, `(${admin.nombre})`);
  await prisma.$disconnect();
}

main();
