# Deploy de la API (Docker)

La API (`apps/api`, NestJS) se empaqueta con `apps/api/Dockerfile`. El **build context es la raíz del repo** (monorepo pnpm).

## Build & run local

```bash
# desde la raíz del repo
docker build -f apps/api/Dockerfile -t vnzl-api .

docker run --rm -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="..." \
  -e WEB_ORIGIN="https://tu-app.vercel.app" \
  -e PORT=3001 \
  vnzl-api
```

## Variables de entorno

| Var | Requerida | Para qué |
|-----|-----------|----------|
| `DATABASE_URL` | sí | Postgres (Prisma + adapter-pg). |
| `REDIS_URL` | sí | Redis (cache + rate-limit, ioredis). |
| `JWT_SECRET` | sí | Firma de invitaciones (JWT). |
| `WEB_ORIGIN` | prod | Origen(es) permitido(s) por CORS, separados por coma (p. ej. el dominio de Vercel). Sin esta var se permite todo (dev). |
| `PORT` | la inyecta la plataforma | Puerto de escucha. Fallback: `API_PORT` y luego `3001`. |
| `APP_ID_CEDULA`, `TOKEN_CEDULA` | opcional | Verificación de cédula (CEN-23); sin ellas se omite. |

## Plataformas

Sirve cualquiera que corra contenedores: **Render**, **Railway**, **Fly.io**, **Cloud Run**.
- Apuntan al `Dockerfile`, inyectan `PORT`, y se conectan a Postgres + Redis gestionados (de la misma plataforma, o Neon/Supabase + Upstash).
- En Vercel, setear `NEXT_PUBLIC_API_URL` con el dominio público de la API.

## Notas

- `WEB_ORIGIN` debe incluir el dominio de Vercel o el browser bloqueará las llamadas (CORS).
- `/uploads` se sirve desde disco local del contenedor (efímero). Para producción real, mover a object storage (ya marcado con `ponytail:` en `main.ts`).
- La imagen incluye devDeps (no se hace `pnpm prune --prod` porque rompe el cliente Prisma generado). Si el tamaño importa, regenerar Prisma después de podar.
