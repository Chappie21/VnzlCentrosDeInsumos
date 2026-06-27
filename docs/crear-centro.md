# Flujo: Registrar Nuevo Centro de Acopio

> Estado: implementado · Última actualización: 2026-06-27 · Branch/PR: feat/crear-centro

## 1. Requerimientos

Vista "Registrar Nuevo Centro de Acopio" (diseño Stitch, mobile). Solo accesible
para usuarios **autenticados** (identidad completa: nombre + cédula + teléfono).

- Formulario: nombre, ciudad, estado/provincia, dirección completa, geolocalización
  (botón "Obtener Ubicación Actual" → latitud/longitud) con vista previa de mapa.
- Botón "Registrar Centro". Al crear, pantalla de éxito con el nombre del centro,
  badge "ACTIVO", y acciones "Ver mi Centro de Acopio" / "Invitar Ayudantes".
- Sin bottom navigation (el diseño trae su propio header con X de cerrar).

## 2. Decisiones

- **Backend sin cambios.** `POST /centros` ya existía (guardado con `IdentidadGuard`
  + `RateLimitGuard`, `CreateCentroDto` = nombre/estado/ciudad/direccion + lat/lng
  opcionales). El payload de respuesta (fila Prisma del centro) cubre la pantalla de
  éxito (`id`, `nombre`, `recibiendoAhora`→ACTIVO) sin fuga de PII (el `Voluntario`,
  que lleva el fingerprint, se crea en la misma tx pero **no** se retorna). Se sumó
  un test unitario de `create()` (faltaba; solo `list` estaba cubierto).
- **Ruta sin chrome.** Nuevo grupo `app/(full)/` **sin** `layout.tsx` → hereda los
  `Providers` (QueryClient) pero no la `TopAppBar`/`BottomNav`. Ruta `/centros/nuevo`.
- **Auth gate cliente.** En `useEffect`: `hasFullIdentity()` o `syncIdentity()`
  (rehidrata desde backend si se limpió localStorage); si sigue sin identidad,
  `router.replace('/?next=/centros/nuevo')`. Se usa `replace` para que el back no
  regrese a la vista gateada.
- **Vista previa de mapa = placeholder estático** (`ponytail`): sin dependencia de
  mapa para el MVP. Upgrade a imagen de static-map más adelante.
- **"Invitar Ayudantes" = no-op** (`ponytail`): el flujo de invitación no existe aún.
- **Éxito sin navegar.** El submit togglea estado local `screen` form→success en la
  misma ruta (mantiene el nombre creado en memoria). "Ver mi Centro" → `/mi-centro`.

## 3. Diseño técnico

### Frontend
- `app/(full)/centros/nuevo/page.tsx` (`"use client"`): orquestador. Auth gate,
  `useForm<CentroInput>` con resolver que adapta `validateCentro` al formato RHF,
  `useGeolocation` (efecto que vuelca coords a `setValue` lat/lng), `useMutation`
  (`createCentro`) con manejo de respuesta no-ok igual que onboarding, invalida
  `[QK.centros]` en éxito (prefijo de `centrosKeys.list` → el directorio refetchea).
- `app/(full)/centros/nuevo/_components/` (barrel): `GeolocationCard` (presentacional:
  botón pedir ubicación, lat/lng readonly, placeholder de mapa, mensaje si `denied`),
  `SuccessView` (check verde, card nombre + badge ACTIVO, dos acciones).
- `app/_components/TextAreaField.tsx`: `forwardRef<HTMLTextAreaElement>` reusando el
  estilo de `Field` (que es input-only) para la dirección.
- `lib/api.ts`: `createCentro(body)` (POST /centros) + tipos `CreateCentroBody`,
  `CreatedCentro`.
- `lib/validate.ts`: `validateCentro` (espeja `CreateCentroDto`; nombre≥3, ciudad/estado
  requeridos, dirección≥5, lat/lng en rango si vienen). Cliente más estricto que el
  server → nunca 400 por longitud.
- `constants/routes.ts`: `crearCentro: "/centros/nuevo"`.
- FAB del directorio (`(app)/centros/page.tsx`) recableado: `requireHelp(router,
  ROUTES.crearCentro, () => router.push(ROUTES.crearCentro))`.

## 4. Seguridad / edge cases
- Vista solo para identidad completa (gate cliente + el `POST` ya está guardado por
  `IdentidadGuard` en el server, defensa en profundidad).
- Fingerprint solo en el header (`x-fingerprint` vía `apiFetch`); nunca en el payload
  de crear. La respuesta de `create` es la fila del centro del propio creador, sin PII
  de terceros ni el `Voluntario`.
- GPS denegado → mensaje; el usuario puede registrar sin coordenadas (lat/lng opcionales).
- Respuesta no-ok del backend → mensaje de error inline, sin perder lo escrito.

## 5. Verificación
- **API**: `apps/api/src/centros.test.ts` → 12 tests (sumado `create()`: tx crea
  Centro + Voluntario, `bumpCentros` llamado, fila retornada). `pnpm --filter @vnzl/api test`.
- **Web**: 34 tests (sumados `validateCentro` + `TextAreaField`/`GeolocationCard`/
  `SuccessView`). `pnpm --filter @vnzl/web test`.
- **Build**: `pnpm --filter @vnzl/web build` → rutas `/centros` y `/centros/nuevo`.

## 6. Pendientes / deuda
- Vista previa de mapa real (hoy placeholder estático).
- Flujo "Invitar Ayudantes" (hoy no-op): endpoint de invitación/unión + vista.
- Proyección allowlist en `create` (hoy retorna fila cruda; no es fuga, solo simetría
  con el `cardSelect` del listado).
