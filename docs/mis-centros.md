# Flujo: Mis Centros (rol del voluntario)

> Estado: implementado (backend) · Última actualización: 2026-06-27 · Branch/PR: feat/mis-centros-roles

## 1. Requerimientos

El dashboard "Mis Centros" lista los centros donde el usuario es voluntario y debe
distinguir su **rol** en cada uno: quien creó el centro es su **dueño** (JEFE) y
puede gestionarlo; los demás se sumaron vía invitación (VOLUNTARIO).

## 2. Decisiones (backend)

- **Rol en el join `Voluntario`.** Nuevo enum `RolVoluntario { JEFE, VOLUNTARIO }` y
  campo `rol RolVoluntario @default(VOLUNTARIO)` en `model Voluntario`
  (`packages/database/prisma/schema.prisma`). El default cubre la ruta de aceptar
  invitación (`usuarios.ts`) sin tocarla.
- **JEFE al crear.** `CentrosService.create` (`apps/api/src/centros.ts`) crea el
  `Voluntario` del creador con `rol: RolVoluntario.JEFE` dentro de la misma
  transacción. Sin magic strings: se usa el enum importado de `@vnzl/database`.
- **`mias` expone el rol del usuario actual.** `miCentroSelect` pasó de const a
  función de `fingerprint`: agrega una relación `voluntarios` filtrada al usuario
  (`where: { usuarioId }`, `select: { rol }`, `take: 1`). Es key distinta de
  `_count.voluntarios` (el total sigue intacto). `toMiCentro` extrae
  `rol = c.voluntarios[0]?.rol ?? RolVoluntario.VOLUNTARIO` y lo agrega al tipo
  `MiCentro`; `voluntarios` (número) sigue mapeando desde `_count.voluntarios`.
- **Sin fuga de PII.** La relación filtrada solo selecciona `rol` (nunca
  fingerprint); el payload de `MiCentro` no cambia su superficie salvo el nuevo `rol`.

## 3. Migración de datos

`prisma db push`/migración la corre el usuario (no hay DB en este entorno). El cliente
se regenera con `pnpm --filter @vnzl/database exec prisma generate` para que los tipos
TS incluyan el enum. Centros existentes quedarán con `VOLUNTARIO` por el default; si se
requiere, backfill manual del creador a `JEFE`.

## Frontend

> Estado: implementado (frontend) · Branch/PR: feat/mis-centros-roles

### Ruta y navegación

- Tab renombrado de "Mi Centro" a **"Mis Centros"**; ruta `ROUTES.misCentros = "/mis-centros"`
  (antes `miCentro: "/mi-centro"`). Carpeta `app/(app)/mi-centro/` renombrada a
  `app/(app)/mis-centros/`. `requiresIdentity: true` se mantiene.

### Capa de datos

- `app/lib/api.ts`: tipos `RolCentro`, `MiInsumo`, `MiCentro` y
  `getMisCentros(): Promise<MiCentro[]>` que llama `GET /centros/mios` vía `apiFetch`
  (fingerprint en header `x-fingerprint`, nunca en URL/body).
- `app/constants/query-keys.ts`: `centrosKeys.mios()` → `["centros", "mios"]`.
- `app/_hooks/useMisCentros.ts`: `useQuery` (lista personal chica, sin scroll infinito),
  keyed por `centrosKeys.mios()`. Exportado por el barrel `_hooks`.

### UI

- `app/(app)/mis-centros/page.tsx` (`"use client"`): consume `useMisCentros`, parte la
  lista en dos secciones por `rol` — **"Tus centros"** (JEFE) y **"Donde ayudás"**
  (VOLUNTARIO). Estados loading/error; si ambas vacías → `EmptyState` con FAB a
  `ROUTES.crearCentro`. Una sección vacía se oculta.
- `app/(app)/mis-centros/_components/MiCentroCard.tsx`: nombre, ciudad/estado, badge de
  rol, nº de voluntarios, nº de insumos y estado `recibiendoAhora`. Sin link de detalle
  todavía (la ruta no existe; marcado con `// ponytail:`).
- Sin magic strings: `ROL_LABEL` (JEFE→"Dueño", VOLUNTARIO→"Voluntario") y `SECCIONES`
  en `app/constants/mis-centros.ts`.
- Test: `MiCentroCard.test.tsx` verifica el badge "Dueño"/"Voluntario" según el rol.
