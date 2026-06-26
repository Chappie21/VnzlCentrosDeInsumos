# Plataforma Logística de Emergencia — Centros de Acopio (Venezuela)

Monorepo Turborepo: `apps/web` (Next.js), `apps/api` (NestJS), `packages/database` (Prisma).

## Arrancar

```bash
cp .env.example .env
docker compose up -d          # Postgres + Redis
pnpm install
pnpm db:push                  # crea el esquema
pnpm dev                      # web :3000, api :3001
```

`pnpm dev` abre el **TUI interactivo de Turbo** (consola dividida web + api).
Flechas ↑/↓ para cambiar de app, click o `Enter` para enfocar, `Ctrl-C` para salir.

## Versiones (latest, jun 2026)

Turbo 2.10 · Next 16 · React 19.2 · NestJS 11 · Prisma 7 · Tailwind 4 · TypeScript 6.

Notas de los majors que cambian forma:
- **Prisma 7**: el `url` ya no va en `schema.prisma`. CLI lo lee de `prisma.config.ts`; el runtime usa el driver adapter `@prisma/adapter-pg` (`packages/database/src/index.ts`).
- **Tailwind 4**: sin `tailwind.config.ts`. CSS-first: `@import "tailwindcss"` + plugin `@tailwindcss/postcss`.

## Identidad sin login (spec §3)

Toda request lleva el header `x-fingerprint: <uuid>` (el front lo genera y guarda en `localStorage`).
Onboarding (`POST /usuarios/onboard`) es obligatorio antes de crear centros, donar o ser voluntario.

## Endpoints clave

| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/centros?lat&lng` | Directorio público, cacheado en Redis 30s. Con `lat/lng` ordena por Haversine. |
| POST | `/centros` | Identificado. Rate-limit Redis 10/min. Crea centro + te hace voluntario. |
| POST | `/usuarios/onboard` | Guarda nombre/cédula/teléfono. |
| POST | `/invitaciones` | Voluntario del centro genera JWT (24h) para link/QR. |
| POST | `/invitaciones/aceptar` | Canjea el token → te vuelve voluntario (exige identidad completa). |
| POST | `/historial` | Movimiento manual `+`/`-`. Solo voluntario del centro. Transacción. |
| POST | `/historial/batch` | Drop-off por QR. Todo-o-nada. Solo voluntario del centro. |

**Regla de oro:** `cantidadTotal` nunca se edita; se mueve creando `Historial` dentro de una transacción que hace `increment`.

## Tests

```bash
pnpm --filter @vnzl/api test     # lógica geoespacial (Haversine + orden)
```

## Deferido (a propósito)

- shadcn/ui: instala con `pnpm dlx shadcn@latest add button card` cuando quieras componentes. Hoy la web es Tailwind plano.
- Carrito de donaciones + escáner QR en el front: el backend (`/historial/batch`) ya lo soporta; falta la UI.
- PostGIS: el orden geoespacial es en memoria. Migra solo si los centros llegan a miles.
- Trigger SQL real para `cantidadTotal`: hoy la suma vive en la transacción de la app. Un trigger en Postgres lo blindaría incluso ante escrituras fuera de la API.
