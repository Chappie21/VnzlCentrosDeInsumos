import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for direct connections.
// DATABASE_URL is loaded by the host process (dotenv in the API, Next for web).
// Pool acotado: en Postgres de tier hobby (Neon/Supabase free) el límite de
// conexiones es bajo; un pool chico evita agotarlo. Configurable por env.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 5,
  idleTimeoutMillis: 30_000,
});

// ponytail: single shared client. global cache survives Next/Nest hot-reload.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export * from "@prisma/client";
