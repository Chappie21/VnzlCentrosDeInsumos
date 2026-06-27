# AGENTS.md

Guía para personas y agentes que trabajan en este repo. Léela antes de tocar código.

## De qué trata el proyecto

**Plataforma logística de emergencia** para gestionar centros de acopio y donaciones
tras un sismo en Venezuela. Prioridades: despliegue rápido, consistencia de datos bajo
concurrencia, **cero fricción** para el usuario, y agilizar la recepción física de
donaciones con geolocalización y códigos QR.

Identidad **sin login**: cada dispositivo tiene un `fingerprint` (UUID) en `localStorage`
que se manda como header `x-fingerprint`. El onboarding (nombre, cédula, teléfono) es
obligatorio antes de contribuir; "solo observar" usa un fingerprint anónimo.

## Stack

- **Monorepo**: Turborepo + pnpm. TUI con `pnpm dev`.
- **apps/web**: Next.js 16 (App Router) · Tailwind 4 (CSS-first) · TanStack Query · react-hook-form.
- **apps/api**: NestJS 11.
- **packages/database**: Prisma 7 (driver adapter `@prisma/adapter-pg`).
- **Infra local**: Docker (PostgreSQL + Redis).
- Node 24 · TypeScript 6.

## Comandos

```bash
pnpm install
docker compose up -d            # Postgres + Redis
pnpm db:push                    # sincroniza el esquema
pnpm dev                        # web :3000, api :3001 (TUI)
pnpm --filter @vnzl/api test    # tests api
pnpm --filter @vnzl/web test    # tests web
```

## Convenciones de código (obligatorias)

### DRY
No repitas lógica. Si un bloque aparece dos veces, extraelo (función, hook, helper,
componente). Antes de escribir algo nuevo, buscá si ya existe.

### Componentización y reutilización
- UI en componentes chicos y reutilizables (ej. `apps/web/app/_components/Field.tsx`).
- Un componente = una responsabilidad. Si crece o se ramifica, partilo.
- Reusá antes de duplicar: extendé el componente existente vía props.

### Documentación de código (solo lo necesario)
- Comentá el **por qué**, no el **qué** (el código ya dice qué hace).
- Documentá invariantes, decisiones no obvias y ceilings conocidos.
- Nada de comentarios de relleno ni JSDoc en funciones triviales.

### Tests
- **Un unit test por componente, endpoint (controller) o service.** No se mergea
  lógica no trivial sin su test.
- Vitest en web y api. Sin frameworks/fixtures extra salvo necesidad real.
- Funciones puras y validaciones: cubrí casos válidos e inválidos.

### Barrel files (`index.ts`)
Cada carpeta de feature/módulo expone su API pública con un `index.ts` (barrel).
Importá desde el barrel, no desde rutas internas profundas.

```ts
// apps/web/app/_components/index.ts
export { default as Field } from "./Field";
export { default as Icon } from "./Icon";
```

### Sin magic strings ni valores sueltos
Prohibido hardcodear strings/números repetidos o con significado (claves de
localStorage, rutas, regex, límites, keys de query, mensajes, etc.). Definilos como
**constantes importables** en una carpeta de constantes por app:

- Web: `apps/web/app/constants/` (ej. `storage.ts`, `routes.ts`, `query-keys.ts`).
- API: `apps/api/src/constants/` (ej. `rate-limit.ts`, `auth.ts`).

```ts
// apps/web/app/constants/storage.ts
export const STORAGE = {
  fingerprint: "fingerprint",
  identity: "identity",
  anon: "anon",
} as const;

// apps/web/app/constants/query-keys.ts
export const QK = { centros: "centros" } as const;
```

Cada carpeta de constantes tiene su barrel `index.ts`.

## Documentación de flujos (carpeta `docs/`)

**Todo flujo nuevo se documenta en `docs/`** antes de darlo por terminado.
Un flujo = una feature de punta a punta (ej. onboarding, donación por QR,
invitación de voluntarios). Usá el template de [`docs/README.md`](docs/README.md).

Cada doc de flujo incluye, como mínimo:
1. **Requerimientos iniciales** (los que originaron el flujo, tal cual se pidieron).
2. **Decisiones tomadas** y por qué (alternativas descartadas).
3. **Diseño técnico**: endpoints, modelos, componentes, estado, validaciones.
4. **Seguridad / edge cases** considerados.
5. **Verificación**: cómo se probó (tests, smoke).

## Seguridad

- La identidad es el `fingerprint`. **Nunca exponerlo** en URLs, payloads de QR, logs
  públicos ni respuestas de la API. Es lo único que sostiene el modelo sin login.
- Validá en los límites de confianza (DTOs en API, validación en el form).
- Secretos solo por variables de entorno (`.env`, nunca commiteado).

## Estructura

```
apps/web         Next.js (UI, App Router)
apps/api         NestJS (API REST)
packages/database  Prisma (schema + cliente compartido)
docs/            Documentación de flujos (un .md por flujo)
```
