# Flujo: Gestión de voluntarios (listar + remover, solo JEFE)

> Estado: implementado · Última actualización: 2026-06-27 · Branch: claude/volunteer-management-view-9zsrf9

> **Listo** (backend + frontend). Backend (`apps/api`): `GET /centros/:centroId/voluntarios`
> y `DELETE /centros/:centroId/voluntarios/:voluntarioId`, ambos con `IdentidadGuard` +
> `JefeGuard`, en `centros.ts` (+ `centros.test.ts`). Frontend (`apps/web`): ruta
> `gestionarVoluntarios`, helpers `getVoluntarios`/`removerVoluntario`, hook `useVoluntarios`,
> vista `(app)/mis-centros/[centroId]/voluntarios` con `VoluntarioCard` + `RemoveConfirm`, y
> botón "Gestionar voluntarios" en el detalle (solo JEFE).

## 1. Requerimientos iniciales

Agregar una **vista de gestión de voluntarios** de un centro de acopio, accesible **solo
por el jefe** del centro, desde la vista de **detalle del centro**. La vista debe permitir
**remover** voluntarios. (Continúa el pendiente anotado en
[`invitar-voluntarios.md`](invitar-voluntarios.md) §7: "Lista/gestión de voluntarios —
quitar miembros, ver nombres".)

Referencia de diseño (mockup mobile "Lista de Voluntarios"): listado de miembros con
buscador, botón "Invitar Voluntarios" y acción de remover por miembro.

## 2. Decisiones tomadas

- **Sin migración de DB.** Se usa el modelo `Voluntario` tal cual. El mockup muestra
  badges ACTIVO/INACTIVO, roles granulares (Coordinator/Driver) y avatares; se descartan:
  el esquema solo tiene `rol` (JEFE/VOLUNTARIO) y "estás o no estás" en el acopio. Remover =
  **hard delete** de la fila `Voluntario` (precedente: `deleteMany` en `seed.ts`; no hay
  soft-delete en el repo).
- **Identificador de remoción = `Voluntario.id` (uuid)**, NO el `usuarioId`/`fingerprint`.
  El fingerprint es la identidad del modelo sin-login y **nunca** se expone en URLs ni
  payloads (regla `AGENTS.md`).
- **PII acotada al JEFE:** el listado expone `nombre`, `cedula` y `telefono` para que el
  jefe identifique/contacte a cada voluntario. Es exposición deliberada y solo accesible a
  un JEFE autenticado del centro.
- **Vista dedicada** en `/mis-centros/[centroId]/voluntarios`, espejando la ruta `invitar`,
  alcanzable con un botón "Gestionar voluntarios" del detalle (solo JEFE). El botón
  "Invitar voluntarios" del mockup reusa el flujo existente (`invitarVoluntarios`).
- **No se remueve al JEFE.** El dueño del centro no es removible (regla de negocio en el
  server + botón ausente en la UI).

## 3. Diseño técnico

### Backend (`apps/api/src/centros.ts`)
- **`GET /centros/:centroId/voluntarios`** · `@UseGuards(IdentidadGuard, JefeGuard)` →
  `service.listarVoluntarios(centroId)`. Proyección allowlist `voluntarioSelect`
  (`id, rol, asignadoEn` + `usuario.{nombre, cedula, telefono}`; **nunca** `usuarioId`).
  Ordena por `rol asc` (JEFE primero) y luego `asignadoEn asc`. Devuelve `VoluntarioItem[]`.
- **`DELETE /centros/:centroId/voluntarios/:voluntarioId`** · `@UseGuards(IdentidadGuard,
  JefeGuard)` → `service.removerVoluntario(centroId, voluntarioId)`. Valida pertenencia al
  centro (evita borrado cruzado → `NotFoundException`) y prohíbe remover a un JEFE
  (`BadRequestException`). Borra la fila, `redis.bumpCentros()` y devuelve `{ ok: true }`.
- Reusa el guard **`JefeGuard`** (`apps/api/src/guards.ts`), idéntico patrón que
  `PATCH /centros/:centroId`.

### Frontend (`apps/web`)
- **Rutas** (`constants/routes.ts`): `gestionarVoluntarios: (id) => /mis-centros/${id}/voluntarios`.
- **API** (`lib/api.ts`): `getVoluntarios(centroId)` y `removerVoluntario(centroId, voluntarioId)`;
  tipo `VoluntarioItem`.
- **Query keys** (`constants/query-keys.ts`): `centrosKeys.voluntarios(centroId)`.
- **Hook** (`_hooks/useVoluntarios.ts`): `useQuery` espejo de `useCentroDetalle`.
- **Textos** (`constants/voluntarios.ts`): objeto `VOLUNTARIOS`.
- **Vista** `(app)/mis-centros/[centroId]/voluntarios/page.tsx`: gate de rol vía
  `useCentroDetalle` (si `rol !== "JEFE"` → `EmptyState`), buscador con `useDebouncedValue`
  (filtra nombre/teléfono/cédula en cliente), contador, botón "Invitar voluntarios" y lista
  de `VoluntarioCard`.
- **Componentes** `voluntarios/_components/`: `VoluntarioCard` (nombre, rol, contacto; botón
  remover oculto si es JEFE; `useMutation` → invalida `voluntarios` + `detalle`),
  `RemoveConfirm` (diálogo de confirmación, patrón overlay de `TopAppBar`).
- **Entrada**: botón "Gestionar voluntarios" en `(app)/mis-centros/[centroId]/page.tsx`,
  junto a "Invitar voluntarios", ambos bajo `rol === "JEFE"`.

### Datos
Sin cambios de esquema. Modelos: `Voluntario` (lectura + delete) y `Usuario` (solo
`nombre/cedula/telefono` vía relación). PK `Voluntario.id` y `@@unique([usuarioId, centroId])`
ya soportan todo.

## 4. Seguridad y edge cases
- **Autorización doble:** `JefeGuard` en ambos endpoints + gate `rol === "JEFE"` en la UI.
  Un VOLUNTARIO que llame la API directo recibe 403.
- **PII:** la respuesta nunca incluye `usuarioId`/`fingerprint`; la remoción va por
  `Voluntario.id`. `nombre/cedula/telefono` solo se exponen a un JEFE del centro.
- **No remover al jefe / borrado cruzado:** el server rechaza filas con `rol === JEFE` y
  filas que no pertenecen al `centroId` de la ruta.
- **Doble click / fila ya removida:** el endpoint responde `NotFound`; la UI invalida la
  query igual y la lista se reconcilia.
- **Cache:** `bumpCentros()` tras remover (el conteo de voluntarios viaja en el directorio
  público y en el detalle).

## 5. Verificación
- **Unit tests:** `pnpm --filter @vnzl/api test` (casos nuevos en `centros.test.ts`:
  listado/proyección/orden, remoción ok, NotFound de otro centro, BadRequest al jefe, y
  delegación del controller) y `pnpm --filter @vnzl/web test` (`voluntarios/page.test.tsx`,
  `VoluntarioCard.test.tsx`, `RemoveConfirm.test.tsx`).
- **Smoke:** como JEFE, invitar a un 2º dispositivo y aceptar; abrir el detalle → "Gestionar
  voluntarios" → la lista muestra al jefe + voluntario con contacto; remover al voluntario y
  ver que baja el contador; el botón de remover del jefe no aparece. Como VOLUNTARIO no se ve
  el botón y `GET/DELETE` directos dan 403.

## 6. Pendientes / deuda
- Búsqueda/paginación server-side: hoy la lista de un centro es chica y se filtra en cliente
  (se ignora el "Load more" del mockup). Si un centro escala a cientos de voluntarios, mover
  el filtro y la paginación al backend.
- Estados/roles granulares y avatares del mockup: fuera de alcance (no hay soporte en el
  esquema). Requeriría migración si se pide a futuro.
