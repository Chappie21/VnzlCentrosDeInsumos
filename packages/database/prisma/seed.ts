import { hash } from "bcryptjs";
import { config } from "dotenv";

// Cargar env ANTES de importar el cliente (src/index.ts lee DATABASE_URL al evaluarse).
config({ path: "../../.env" });

// ids estables -> upsert idempotente (re-correr no duplica).
const CENTROS = [
  {
    id: "seed-centro-deportivo",
    nombre: "Centro Deportivo Municipal",
    estado: "Distrito Capital",
    ciudad: "Caracas",
    direccion: "Av. Principal 123, Zona Centro",
    latitud: 10.5,
    longitud: -66.91,
    recibiendoAhora: true,
    horarioCierre: null as string | null,
    insumos: [
      { nombre: "Agua potable", nivel: "URGENTE", categoria: "AGUA" },
      { nombre: "Medicamentos", nivel: "URGENTE", categoria: "MEDICAMENTOS" },
      { nombre: "Mantas", nivel: "NORMAL", categoria: "ROPA" },
    ],
  },
  {
    id: "seed-escuela-bolivar",
    nombre: "Escuela Primaria Simón Bolívar",
    estado: "Miranda",
    ciudad: "Los Teques",
    direccion: "Calle 4 Sur, Sector Obrero",
    latitud: 10.34,
    longitud: -67.04,
    recibiendoAhora: false,
    horarioCierre: "20:00",
    insumos: [
      { nombre: "Ropa", nivel: "SUFICIENTE", categoria: "ROPA" },
      { nombre: "Alimentos no perecederos", nivel: "NORMAL", categoria: "ALIMENTOS" },
    ],
  },
  {
    id: "seed-plaza-constitucion",
    nombre: "Plaza de la Constitución",
    estado: "Carabobo",
    ciudad: "Valencia",
    direccion: "Explanada Central",
    latitud: 10.16,
    longitud: -68.0,
    recibiendoAhora: true,
    horarioCierre: null,
    insumos: [
      { nombre: "Herramientas", nivel: "URGENTE", categoria: "HERRAMIENTAS" },
      { nombre: "Agua potable", nivel: "SUFICIENTE", categoria: "AGUA" },
    ],
  },
  {
    id: "seed-polideportivo-zulia",
    nombre: "Polideportivo de Maracaibo",
    estado: "Zulia",
    ciudad: "Maracaibo",
    direccion: "Av. 5 de Julio con Calle 72",
    latitud: 10.65,
    longitud: -71.64,
    recibiendoAhora: true,
    horarioCierre: null,
    insumos: [
      { nombre: "Alimentos no perecederos", nivel: "URGENTE", categoria: "ALIMENTOS" },
      { nombre: "Medicamentos", nivel: "NORMAL", categoria: "MEDICAMENTOS" },
      { nombre: "Agua potable", nivel: "SUFICIENTE", categoria: "AGUA" },
    ],
  },
  {
    id: "seed-iglesia-merida",
    nombre: "Parroquia Sagrado Corazón",
    estado: "Mérida",
    ciudad: "Mérida",
    direccion: "Calle 25 entre Av. 3 y 4",
    latitud: 8.59,
    longitud: -71.14,
    recibiendoAhora: false,
    horarioCierre: "18:00",
    insumos: [
      { nombre: "Ropa", nivel: "SUFICIENTE", categoria: "ROPA" },
      { nombre: "Mantas", nivel: "SUFICIENTE", categoria: "ROPA" },
    ],
  },
  {
    id: "seed-centro-sin-coords",
    nombre: "Refugio Comunitario El Valle",
    estado: "Distrito Capital",
    ciudad: "Caracas",
    direccion: "Sector El Valle (ubicación por confirmar)",
    latitud: null as number | null,
    longitud: null as number | null,
    recibiendoAhora: true,
    horarioCierre: null,
    insumos: [{ nombre: "Agua potable", nivel: "URGENTE", categoria: "AGUA" }],
  },
];

async function main() {
  const { prisma } = await import("../src/index");

  for (const { insumos, ...centro } of CENTROS) {
    await prisma.centro.upsert({
      where: { id: centro.id },
      create: centro as never,
      update: centro as never,
    });
    // insumos sin id estable -> reemplazar para mantener idempotencia
    await prisma.insumo.deleteMany({ where: { centroId: centro.id } });
    await prisma.insumo.createMany({
      data: insumos.map((i) => ({ ...i, centroId: centro.id })) as never,
    });
  }

  const seedUser = await prisma.usuario.upsert({
    where: { cedula: "V0000000" },
    update: {},
    create: {
      nombre: "Usuario Semilla",
      cedula: "V0000000",
      telefono: "04140000000",
      // contraseña "seed1234" hasheada — solo dev
      passwordHash: await hash("seed1234", 10),
    },
  });

  console.log(`Seed OK: ${CENTROS.length} centros, seedUser.id=${seedUser.id}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
