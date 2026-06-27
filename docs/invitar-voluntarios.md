# Flujo: Invitación de Voluntarios (QR + link JWT 1h)

> Estado: implementado · Última actualización: 2026-06-27 · Branch: feat/invitar-voluntarios

> **Listo** (backend + frontend). Backend (`apps/api`): `invite` 1h → `{token, expiresInMin}`,
> `POST /invitaciones` con `RateLimitGuard` + `JefeGuard`, `accept` retorna `{centroId, nombre}`
> con `RateLimitGuard` + `IdentidadGuard`, `usuarios.test.ts`. Frontend (`apps/web`): rutas
> `invitarVoluntarios`/`unirse`, helpers `crearInvitacion`/`aceptarInvitacion`, vista
> `(app)/mis-centros/[centroId]/invitar`, página `(full)/unirse/[token]`, acción "Invitar
> voluntarios" en el detalle (solo JEFE) y wiring de `SuccessView.onInvitar`.

## 1. Requerimientos

Un centro genera un **QR o link de invitación** (JWT, expira en **1 hora**) para que
personas **ya autenticadas** (identidad completa) se unan como **VOLUNTARIO**.

- **Solo el JEFE** del centro puede crear invitaciones (`JefeGuard`).
- El link/QR apunta a `/unirse/[token]`; quien lo abre, si está autenticado, se une al
  centro; si no, pasa por onboarding y vuelve.
- Diseño Stitch "Invitar Ayudantes": card "ESCANEAR PARA UNIRSE" + QR, botón "Descargar
  QR", "COMPARTIR ENLACE DE INVITACIÓN" con link readonly + "Copiar", texto de expiración.

## 2. Estado previo

Ya existen stubs en `apps/api/src/usuarios.ts`:
- `invite(centroId)` — firma JWT `{ centroId }` con `expiresIn` **24h** (se baja a 1h),
  guardado hoy con `VoluntarioGuard` (se cambia a `JefeGuard`), **sin RateLimitGuard**.
- `accept(fingerprint, token)` — `jwt.verify` + `prisma.voluntario.upsert` con `update:{}`
  (no degrada al JEFE si re-acepta; rol nuevo = `VOLUNTARIO` por default). Guardado con
  `IdentidadGuard`, **sin RateLimitGuard**.

`Qr` (`apps/web/app/_components/Qr.tsx`, `qrcode.react`) y el patrón de página pública por
token (`(full)/guia/[id]`) ya están. No hay UI de invitación ni helpers en `lib/api.ts`.

## 3. Decisiones

- **Solo JEFE invita**: `POST /invitaciones` pasa de `VoluntarioGuard` a `JefeGuard`. El
  botón "Invitar voluntarios" del detalle se muestra solo si `rol === "JEFE"`.
- **Expiración 1h**: `expiresIn: "1h"`; `invite()` devuelve `{ token, expiresInMin: 60 }`
  (la URL absoluta la arma el front con su `origin`, como envíos). Texto "expira en 1 hora".
- **Link multi-uso dentro de 1h**: varios voluntarios pueden usar el mismo QR mientras no
  expire (es un link de invitación, no de un solo uso). El `upsert` es idempotente.
- **Ruta de unión** `/unirse/[token]` (convención español; el diseño dibuja `/join`).
- **RateLimitGuard en ambos endpoints** (hallazgo: hoy desprotegidos → minteo/abuso).

## 4. Backend (`apps/api`)

- `invite(centroId)`: `expiresIn "1h"`, retorna `{ token, expiresInMin: 60 }`.
  `POST /invitaciones` → `@UseGuards(RateLimitGuard, JefeGuard)` (+ `IdentidadGuard` si hace
  falta para `fingerprintOf`). `JefeGuard` lee `centroId` de `body`.
- `accept(fingerprint, token)`: igual lógica; **retorna `{ centroId, nombre }`** del centro
  (para la pantalla de éxito). `POST /invitaciones/aceptar` →
  `@UseGuards(RateLimitGuard, IdentidadGuard)`.
- Tests (`usuarios.test.ts`, nuevos): invite firma token 1h con `centroId`; accept verifica +
  upsert `VOLUNTARIO` + retorna nombre; token inválido/expirado → 401; JEFE re-acepta y no
  pierde rol.

## 5. Frontend (`apps/web`)

- `constants/routes.ts`: `invitarVoluntarios: (id) => /mis-centros/${id}/invitar`,
  `unirse: (token) => /unirse/${token}`.
- `lib/api.ts`: `crearInvitacion(centroId)` (POST `/invitaciones` → `{token, expiresInMin}`),
  `aceptarInvitacion(token)` (POST `/invitaciones/aceptar` → `{centroId, nombre}`).
- **Vista Invitar** `(app)/mis-centros/[centroId]/invitar/page.tsx`: al montar
  `crearInvitacion(centroId)` → token; URL = `${location.origin}/unirse/${token}`; `Qr` +
  link readonly + Copiar (`navigator.clipboard`) + Descargar QR (serializa el SVG → blob,
  `ponytail`) + "expira en 1 hora" + Regenerar.
- **Detalle** `(app)/mis-centros/[centroId]`: acción "Invitar voluntarios" → link a la vista
  invitar, **solo si `rol === "JEFE"`**.
- **`SuccessView.onInvitar`** (hoy no-op): al crear centro, navegar a
  `invitarVoluntarios(nuevoCentroId)` (hace falta guardar el `id` que devuelve `createCentro`).
- **Página de unión** `(full)/unirse/[token]/page.tsx` (sin chrome, patrón `guia/[id]`): si no
  autenticado → `router.replace('/?next=/unirse/${token}')`; si autenticado →
  `aceptarInvitacion(token)` → éxito "Te uniste a {nombre}" + "Ver centro" (→ detalle) +
  invalida `[QK.centros]`; token expirado/inválido → mensaje + CTA.
- Tests: vista invitar renderiza QR con URL `/unirse/`; página unión muestra éxito al aceptar.

## 6. Seguridad

- JWT 1h, secret `JWT_SECRET`. Token solo lleva `centroId` (sin PII).
- `RateLimitGuard` nuevo en invite + accept.
- Crear invitación: solo JEFE (`JefeGuard`). Unirse: solo identidad completa (`IdentidadGuard`).
- Fingerprint solo en header. Defensa en profundidad: backend valida aunque la UI gatee.

## 7. Pendientes / deuda

- Descargar QR vía serialización SVG (`ponytail`): si se necesita PNG, renderizar a canvas.
- Lista/gestión de voluntarios (quitar miembros, ver nombres) — pantalla aparte del diseño.
- Revocar invitaciones antes de expirar: hoy no hay (los tokens son stateless). Si hace falta,
  mover a invitaciones persistidas con estado.
