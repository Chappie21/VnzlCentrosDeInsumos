# Flujo: Directorio de Centros

> Estado: implementado · Última actualización: 2026-06-26 · Branch/PR: feat/directorio-centros

## 1. Requerimientos iniciales

Vista "Directorio de Centros" (diseño Stitch, mobile). Pedido textual:

- Vista para listar centros de acopio. Cualquiera puede verla (incluye el modo "solo
  observar"); a los no autenticados se les ocultan ciertas opciones (p. ej. "Mi Centro
  de Acopio" y "Escanear/QR" no se muestran).
- No hardcodear datos: consumir un endpoint real, con un **seed local** de centros para
  ver el listado.
- **Bottom navigation** como **componente global** (compartido entre vistas).
- El EP de listado debe funcionar con **paginación** y los **filtros** del diseño:
  búsqueda por ciudad/nombre, "Cerca de mí", "Solo Abiertos", "Urgencia Alta".
- Cards con: nombre, dirección, distancia ("A X.Xkm"), badges de necesidades
  (con color por urgencia + ícono por categoría) y footer de estado
  ("RECIBIENDO AHORA" / "Cerrado"). FAB "Agregar centro de acopio".

## 2. Decisiones tomadas

- **Directorio público** (sin guard en `GET /centros`): mirar dónde donar es de baja
  sensibilidad y debe ser cero fricción. Las acciones de operador siguen guardadas.
  Alternativas descartadas: `IdentidadGuard` (mucha fricción), `UsuarioExisteGuard`
  (se propuso, pero el usuario pidió acceso público).
- **Tabs ocultas por identidad**: "Mi Centro" y "Escanear" tienen `requiresIdentity`
  y se ocultan a quien no tiene identidad completa (en `BottomNav`).
- **`recibiendoAhora` Boolean** (Activo/Cerrado) + `horarioCierre String?` display-only.
  El operador lo cambia a mano (se gestionará más adelante). Descartado: modelo de
  horarios con timezone (YAGNI para MVP).
- **Paginación offset** (`page`/`limit`) en el envelope, consumida con
  `useInfiniteQuery` + scroll infinito. Razón: el orden por proximidad es Haversine
  **en memoria**, incompatible con cursor en DB. Cursor + PostGIS quedan como upgrade.
- **Invalidación de cache por contador de versión** (`centros:list:version` con `INCR`):
  invalida todas las combinaciones filtros+página sin `SCAN`/`KEYS`. Reemplaza el
  `del("centros:list")` previo (en `centros.ts` e `historial.ts`).
- **Coords redondeadas** en la query-key (`GEO_PRECISION`): evita refetch por jitter GPS.
- Reuso de tokens `@theme` existentes (`emergency`/`safety`/`success`/`primary-container`),
  sin tokens nuevos.

## 3. Diseño técnico

### Backend
- `GET /centros` (público). DTO `ListCentrosQueryDto` (class-validator):
  `page, limit, q, lat, lng, radiusKm, soloAbiertos, urgenciaAlta`.
- Envelope: `{ items, page, limit, total, hasNext }`.
- Card projection (allowlist `Prisma.select`, **nunca** fingerprint/voluntarios):
  `id, nombre, ciudad, estado, direccion, recibiendoAhora, horarioCierre, distanciaKm,
  prioridadAlta, necesidades[{ nombre, nivel, categoria }]` (cap `maxBadges`, URGENTE primero).
- `CentrosService.list`: compone `where` (q OR nombre/ciudad insensitive; soloAbiertos →
  `recibiendoAhora`; urgenciaAlta → `insumos.some.nivel=URGENTE`). Sin coords → paginación
  DB (`skip`/`take` + `count`). Con coords → prefiltro bounding-box (si hay radio) +
  `sortByProximity` en memoria (tope `candidateCap`) + filtro de radio + slice de página.
- Cache: `cached(key, TTL.centrosList, fn)` con key `centros:list:v{version}:{hash(params)}`.

### Datos (Prisma)
- `Insumo.nivel NivelInsumo @default(NORMAL)` + `Insumo.categoria CategoriaInsumo?`.
  Índice `@@index([centroId, nivel])`.
- `Centro.recibiendoAhora Boolean @default(true)` + `horarioCierre String?`.
  Índice `@@index([recibiendoAhora])`.
- Enums `NivelInsumo { URGENTE NORMAL SUFICIENTE }`, `CategoriaInsumo { AGUA MEDICAMENTOS
  ROPA ALIMENTOS HERRAMIENTAS }`. Todos aditivos/defaulted → `db:push` seguro.
- Seed: `packages/database/prisma/seed.ts` (idempotente, upsert), `pnpm db:seed`.

### Frontend
- Route group `app/(app)/` con `layout.tsx` cliente = chrome global (`TopAppBar` +
  `BottomNav`) + rehidratación de identidad (`syncIdentity`). Sin redirect (público).
- `app/(app)/centros/page.tsx`: estado `q` (debounced), filtros toggle, geolocalización
  a demanda (solo al activar "Cerca de mí"), `useCentros` (useInfiniteQuery), scroll
  infinito con IntersectionObserver, `EmptyState`, `Fab` (gateado con `requireHelp`).
- Componentes globales (`app/_components`, barrel): `TopAppBar`, `BottomNav`, `Fab`,
  `EmptyState` (+ `Icon`, `Field`).
- Feature (`app/(app)/centros/_components`, barrel): `SearchBar`, `FilterChips`,
  `NeedBadge`, `CentroCard`.
- Hooks (`app/_hooks`, barrel): `useDebouncedValue`, `useGeolocation`, `useCentros`.
- Constantes (`app/constants`, barrel): `routes`, `nav`, `storage`, `query-keys`,
  `filters` (chips, `NIVEL_BADGE`, `CATEGORIA_ICON`, `DEBOUNCE_MS`, `GEO_PRECISION`).
- Tabs sin vista: placeholders "Próximamente" (`mi-centro`, `inventario`, `scanning`).

## 4. Seguridad / edge cases
- Fingerprint solo en el header (`x-fingerprint` vía `apiFetch`); jamás en URL, query-key
  ni payload. La proyección de card es allowlist: no expone PII.
- GPS denegado → la lista queda sin orden por cercanía (sin distancia); el usuario filtra
  manualmente. Geolocalización solo se pide al activar el chip.
- `radiusKm` sin `lat/lng` se ignora. Coords null → centro va al final.
- `total` en modo proximidad es exacto hasta `candidateCap` (ceiling marcado).
- Anónimo puede ver el directorio; el FAB lo manda a onboarding antes de crear.

## 5. Verificación
- **API**: `apps/api/src/centros.test.ts` (paginación, filtros q/soloAbiertos/urgenciaAlta,
  orden+radio por proximidad, cap/orden de badges, proyección sin PII, cache key por
  filtros, controller delega) + `geo.test.ts` (`boundingBox`). `pnpm --filter @vnzl/api test`.
- **Web**: tests por componente (`NeedBadge`, `CentroCard`, `FilterChips`, `SearchBar`,
  `BottomNav`, `Fab`, `EmptyState`, `TopAppBar`). `pnpm --filter @vnzl/web test`.
- **Smoke**: `pnpm up && pnpm db:push && pnpm db:seed`, luego
  `curl 'localhost:3001/centros?urgenciaAlta=true'` y `pnpm dev` → `/centros`.

## 6. Pendientes / deuda
- `total`/orden por proximidad: migrar a PostGIS `ST_DWithin` (ceiling en `geo.ts`).
- Búsqueda `q`: índice `pg_trgm` si la latencia importa a escala.
- Estado del centro: hoy es boolean manual; gestión de operador y horario real, pendiente.
- Flujo "Agregar centro de acopio": el FAB hoy gatea y redirige a `mi-centro` (placeholder).
- Detalle de centro al tocar la card (ruta de detalle no existe aún).
- Vistas reales de `mi-centro`, `inventario`, `scanning`.
