# Flujo: Detalle del Centro (dashboard de miembros)

> Estado: implementado (backend) · Última actualización: 2026-06-27 · Branch/PR: feat/centro-detalle

## 1. Requerimientos

Un centro tiene un dashboard de detalle accesible **solo por sus miembros**
(voluntarios y jefe). Sirve para leer todo el centro y editarlo, con un reparto de
permisos:

- **Datos principales** (nombre, ubicación, coordenadas): editables **solo por el
  JEFE** (dueño).
- **Estado operativo** (`recibiendoAhora`, `horarioCierre`) y **metadata/nivel de
  insumos**: editables por **cualquier voluntario**.
- **`cantidadTotal` es de solo lectura aquí.** Regla de oro: el inventario se mueve
  exclusivamente vía Historial (entradas/salidas transaccionales). Ningún endpoint de
  este flujo la escribe.

## 2. Endpoints (backend)

Todos requieren identidad completa (`IdentidadGuard`) y membresía del centro.

| Método | Ruta | Guards | Quién | Qué |
| --- | --- | --- | --- | --- |
| `GET` | `/centros/:centroId` | `IdentidadGuard`, `VoluntarioGuard` | cualquier miembro | detalle completo |
| `PATCH` | `/centros/:centroId` | `IdentidadGuard`, `JefeGuard` | solo JEFE | datos principales |
| `PATCH` | `/centros/:centroId/operativo` | `IdentidadGuard`, `VoluntarioGuard` | cualquier voluntario | estado operativo |
| `GET` | `/centros/:centroId/voluntarios` | `IdentidadGuard`, `JefeGuard` | solo JEFE | lista de miembros ([voluntarios.md](voluntarios.md)) |
| `DELETE` | `/centros/:centroId/voluntarios/:voluntarioId` | `IdentidadGuard`, `JefeGuard` | solo JEFE | remover un miembro ([voluntarios.md](voluntarios.md)) |
| `PATCH` | `/insumos/:id` | `IdentidadGuard` (+ membresía en service) | cualquier voluntario | metadata de insumo |

**Orden de rutas:** `GET /centros/:centroId` se declara **después** de
`GET /centros/mios` para que el literal `mios` no quede capturado por el param
`:centroId`.

## 3. Decisiones

- **`CentrosService.detalle(fingerprint, centroId)`** usa `detalleSelect(fingerprint)`:
  espeja `miCentroSelect` pero agrega coords (`latitud`/`longitud`), `creadoEn` y
  `descripcion` de cada insumo. Filtra la relación `voluntarios` al usuario actual
  (`where: { usuarioId }`, `select: { rol }`, `take: 1`) para exponer su `rol`, mientras
  `_count.voluntarios` da el total. **Sin PII de terceros** (ni fingerprints ni lista de
  nombres). Tipo de retorno `CentroDetalle` (el frontend lo espeja). Sin cache: refleja
  el inventario al instante.
- **`JefeGuard`** (`guards.ts`) espeja `VoluntarioGuard` (lee `centroId` de
  `params || body`, busca `Voluntario` por `usuarioId_centroId`) pero además exige
  `link.rol === RolVoluntario.JEFE`; si no, `ForbiddenException("Solo el jefe del centro
  puede hacer esto")`. Registrado en `app.module.ts`.
- **`UpdateCentroDto`** (solo JEFE): todos los campos opcionales; reusa los validadores
  whitelist (`estado @IsIn([...ESTADOS])`, `ciudad @IsCiudadDeEstado`). Como el validador
  cross-field de `ciudad` necesita `estado`, la regla es: **si viene `ciudad` se exige
  `estado`** — implementado con `@ValidateIf((o) => o.estado !== undefined || o.ciudad
  !== undefined)` sobre `estado` (cuando hay `ciudad` sin `estado`, `@IsString/@IsIn`
  fallan). El service actualiza solo los campos enviados y llama `bumpCentros()`
  (nombre/ciudad/estado/direccion aparecen en el directorio).
- **`UpdateOperativoDto`** (cualquier voluntario): `recibiendoAhora?: boolean`,
  `horarioCierre?: string | null` (admite `""`/`null` para limpiarlo; es solo display).
  Tras actualizar, `bumpCentros()` porque `recibiendoAhora` alimenta el filtro
  `soloAbiertos` del directorio.
- **`PATCH /insumos/:id`** vive en su propio archivo `apps/api/src/insumos.ts`
  (espeja la estructura de `historial.ts`). La membresía **se valida en el service**
  (opción perezosa correcta): el `centroId` no está en la ruta sino en el insumo, así que
  se carga el insumo (`{ centroId, nivel }`), se verifica `Voluntario` con
  `fingerprintOf(req)` y recién entonces se actualiza. `UpdateInsumoDto` declara
  `nombre?/descripcion?/nivel? (@IsEnum NivelInsumo)/categoria? (@IsEnum CategoriaInsumo)`
  y **NO** incluye `cantidadTotal`; el `ValidationPipe` global (`whitelist: true`) la
  descarta si llega. Si `nivel` cambió, `bumpCentros()` (alimenta `urgenciaAlta`).

## 4. `CentroDetalle` (contrato para el frontend)

```ts
type InsumoDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  nivel: NivelInsumo;            // URGENTE | NORMAL | SUFICIENTE
  categoria: CategoriaInsumo | null;
  cantidadTotal: number;        // solo lectura
};

type CentroDetalle = {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  recibiendoAhora: boolean;
  horarioCierre: string | null;
  creadoEn: Date;               // serializa como ISO string en la respuesta HTTP
  voluntarios: number;          // _count, no lista de PII
  donaciones: number;           // entradas de Historial (cantidad > 0) del centro
  rol: RolVoluntario;           // rol del usuario que pide (JEFE | VOLUNTARIO)
  insumos: InsumoDetalle[];
};
```

## 5. Tests

`apps/api/src/centros.test.ts` (detalle, patch principal/operativo, DTOs),
`apps/api/src/guards.test.ts` (`JefeGuard`),
`apps/api/src/insumos.test.ts` (update de nivel + bump, membresía, `cantidadTotal`
descartada por el pipe).

## Frontend

> Estado: implementado · Branch/PR: feat/centro-detalle

### Rutas
- `(app)/mis-centros/[centroId]/page.tsx` — dashboard de detalle (mantiene bottom nav).
  `MiCentroCard` ahora es un `Link` a `ROUTES.misCentroDetalle(id)` (`/mis-centros/:id`).
- `(full)/mis-centros/[centroId]/editar/page.tsx` — edición de datos principales (JEFE),
  sin chrome. Gate de UX: si `rol !== "JEFE"` redirige al detalle (el `JefeGuard` del
  server es la defensa real).

### Capa de datos (`lib/api.ts`)
- Tipos `CentroDetalle`/`InsumoDetalle`/`NivelInsumo` (espejo del contrato §4).
- `getCentroDetalle(id)` (GET), `updateCentro(id, body)` (PATCH datos principales),
  `updateOperativo(id, body)` (PATCH operativo), `updateInsumo(id, body)` (PATCH insumo).
  Todo vía `apiFetch` (fingerprint en header `x-fingerprint`, nunca en URL/body).
- `useCentroDetalle(id)` (`useQuery`, key `centrosKeys.detalle(id)`).

### Componentes (`[centroId]/_components/`)
- `DetalleHeader` — nombre, ubicación, badge Activo/Cerrado; lápiz de editar **solo si
  `rol === "JEFE"`**.
- Acciones de JEFE (bajo `rol === "JEFE"`): "Gestionar voluntarios" (→ listar/remover, ver
  [voluntarios.md](voluntarios.md)) e "Invitar voluntarios".
- `StatsRow` — insumos, donaciones recibidas, voluntarios, items críticos (= insumos en nivel `URGENTE`).
- `OperativoToggle` — botón que togglea `recibiendoAhora` (`useMutation` → `updateOperativo`).
- `InventarioResumen` — lista de insumos; cada fila deja cambiar el `nivel`
  (`<select>` → `updateInsumo`). `cantidadTotal` se muestra de solo lectura.
- Las mutaciones invalidan `[QK.centros]` (refresca detalle + Mis Centros + directorio).

### Reuso del formulario (DRY)
El form de crear centro se extrajo a `(full)/centros/nuevo/_components/CentroForm.tsx`
(campos + cascada estado→ciudad + mapa Leaflet/geolocalización). Lo consumen tanto
`nuevo` como `editar`. Props: `defaultValues`, `initialPoint`, `submitLabel`,
`pendingLabel`, `pending`, `apiError`, `validateOnMount`, `onSubmit(body)`. El padre
maneja la mutación y el resultado.
- **Gotcha**: la cascada que limpia `ciudad` al cambiar `estado` se saltea en el montaje
  (ref `montado`) para no borrar la ciudad precargada al editar.
- `validateOnMount` (solo `editar`) dispara `trigger()` al montar para que el form
  precargado ya quede válido y el botón "Guardar" no nazca deshabilitado.

### Constantes (`constants/centro-detalle.ts`)
`NIVEL_LABEL`, `NIVELES`, `STATS`. El color del badge reusa `NIVEL_BADGE` de
`constants/filters.ts` (no se duplica).

### Tests
`MiCentroCard.test.tsx` (linkea al detalle), `DetalleHeader.test.tsx` (lápiz solo JEFE).
Los tests del form de `nuevo` siguen verdes tras la extracción de `CentroForm`.
