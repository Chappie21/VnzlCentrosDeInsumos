# Flujo: Inventario inicial + ajustes de stock

> Estado: en implementación · Branch: feat/inventario-inicial (sale de dev)

## 1. Problema

Un centro que ya operaba y se digitaliza no tenía forma de registrar el inventario
que ya poseía: la "regla de oro" dice que `cantidadTotal` solo se mueve vía Historial
(donaciones/envíos), y no existía un movimiento de siembra. Tampoco había forma de
que el JEFE corrigiera un conteo (stock dañado, mal contado).

## 2. Decisión de diseño

**No** se permite escribir `cantidadTotal` directo (eso rompería auditoría y la
métrica de donaciones). En su lugar: **cada movimiento se etiqueta con un `tipo`** y
la siembra/corrección son movimientos normales de Historial. La regla de oro queda
intacta: `cantidadTotal === suma(Historial)`.

```prisma
enum TipoMovimiento {
  DONACION       // escaneo de voluntario (default; lo que ya existía)
  CARGA_INICIAL  // siembra al crear el centro (autoridad: JEFE creador)
  AJUSTE         // corrección manual del JEFE (+/-)
  SALIDA         // despacho (envío)
}

model Historial {
  // ...campos actuales...
  tipo TipoMovimiento @default(DONACION)
}
```

**Permisos:** carga inicial y ajustes los hace el **JEFE**. Voluntarios solo escanean
donaciones (sin fricción; `cantidadTotal` es solo-lectura para ellos).

## 3. Backend

### 3.1 Schema + migración + backfill
- Agregar enum `TipoMovimiento` + `Historial.tipo @default(DONACION)`.
- `prisma db push` (mismo flujo que el enum `rol`).
- **Backfill** (script tsx desechable, patrón del usado para promover JEFE; borrar
  tras correr): `UPDATE "Historial" SET tipo='SALIDA' WHERE "envioId" IS NOT NULL`.
  El resto queda `DONACION` (eran donaciones). `CARGA_INICIAL`/`AJUSTE` no existen en
  data vieja.

### 3.2 Métrica `donaciones` (corrección obligatoria)
`centros.ts → detalle()`:
```ts
// antes: where: { cantidad: { gt: 0 }, insumo: { centroId } }
where: { tipo: TipoMovimiento.DONACION, insumo: { centroId } }
```
Sin esto, la carga inicial (que entra con `cantidad > 0`) inflaría "donaciones
recibidas". Ese es el motivo de existir del campo `tipo`.

### 3.3 Carga inicial = dentro de la creación (una sola transacción)
`CreateCentroDto` gana `insumos?` opcional:
```ts
class InsumoInicialDto {
  @IsString() @MaxLength(80) nombre: string;
  @IsOptional() @IsEnum(CategoriaInsumo) categoria?: CategoriaInsumo;
  @IsInt() @Min(0) cantidad: number;   // DECISIÓN B3: se permite 0 (insumo sin stock aún)
}
class CreateCentroDto {
  // ...campos actuales...
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InsumoInicialDto)
  insumos?: InsumoInicialDto[];
}
```
`CentrosService.create()` **ya** corre en `$transaction` (centro + Voluntario JEFE).
En la **misma** tx, por cada insumo: `tx.insumo.create({ cantidadTotal: 0 })` +
`tx.historial.create({ tipo: CARGA_INICIAL, cantidad })` + `increment`. Atómico: si
algo falla no queda centro a medias. El creador ya es JEFE → autoridad implícita, sin
guard extra. Nombres duplicados en el mismo payload: agrupar case-insensitive (mismo
criterio que `recibir`). `cantidad: 0` igual crea el insumo y su Historial (movimiento
de 0 = registro de que el insumo existe sin stock).

### 3.4 Ajuste post-creación (reemplaza "manipular contadores")
Endpoint nuevo, **solo JEFE**:
```
POST /historial/ajuste   @UseGuards(IdentidadGuard, JefeGuard)
body: { centroId, insumoId, cantidad: number (≠0, +/-), motivo?: string (MaxLength 200) }
```
Service: valida que el insumo pertenece a `centroId`; lee `cantidadTotal`; exige
`cantidadTotal + cantidad >= 0` (si no → `BadRequestException("El stock no puede quedar
negativo")`); aplica `moveOps` con `tipo: AJUSTE`. `bumpCentros()` (puede cambiar
nivel/urgencia indirectamente; barato e idempotente). `motivo` se ignora a nivel de
persistencia por ahora salvo que se agregue columna — **ponytail: no se persiste el
motivo** (no hay columna; el movimiento queda como AJUSTE). Si se quiere auditar el
motivo, agregar `Historial.motivo String?`. Dejar comentado.

> Refactor compartido: `moveOps(tx, insumoId, usuarioId, cantidad, tipo = DONACION)`
> gana el param `tipo` con default `DONACION` para no tocar las llamadas existentes
> (add/batch/recibir siguen igual). `recibir` mantiene `@Min(1)` (una donación de 0 no
> tiene sentido); solo la carga inicial admite 0.

### 3.5 Excel import → NO ahora (YAGNI)
Diferido hasta que un centro real traiga inventario grande. La carga manual cubre MVP.

### 3.6 Tests (uno por lógica no trivial)
- `centros.test.ts`: create con `insumos` siembra Historial `tipo=CARGA_INICIAL` y
  `cantidadTotal` correcto; admite `cantidad:0`; `cantidad:-1` → 400.
- `centros.test.ts`: `donaciones` cuenta solo `tipo=DONACION` (carga inicial no suma).
- `historial.test.ts`: ajuste que dejaría stock <0 → 400; ajuste válido mueve
  `cantidadTotal` y crea Historial `tipo=AJUSTE`.
- Mock de `@vnzl/database` debe exportar el enum `TipoMovimiento` (igual que se hizo
  con `NivelInsumo`/`RolVoluntario`).

## 4. Frontend

### 4.1 Paso "Inventario inicial" en crear centro
`(full)/centros/nuevo/page.tsx` pasa a 2 pasos:
1. `CentroForm` (datos del centro) — ya existe.
2. `InventarioInicialForm` (nuevo) — lista de insumos opcional. Reusa las filas de
   item de `DonacionForm` (nombre + categoría + stepper cantidad). **Stepper `min=0`**
   (decisión B3). Botones "Agregar insumo" y "Omitir por ahora" (sigue sin insumos).

Al confirmar el paso 2 → un único `createCentro({ ...datos, insumos })`.

DRY: extraer las filas de item inline de `DonacionForm.tsx` a un componente
compartido `InsumoRows` (mismo UI: Field nombre + select categoría + stepper).
`DonacionForm` lo consume con `min=1`; `InventarioInicialForm` con `min=0`.

`lib/api.ts`:
```ts
export type InsumoInicial = { nombre: string; categoria?: Categoria; cantidad: number };
export type CreateCentroBody = { /* ...actual... */; insumos?: InsumoInicial[] };
```

### 4.2 Ajuste de stock (JEFE) en el dashboard de detalle
`mis-centros/[centroId]/_components/InventarioResumen.tsx`: por fila, **solo si
`rol==="JEFE"`**, un control "Ajustar" (stepper +/- + input `motivo` opcional) →
`ajustarStock(centroId, insumoId, cantidad, motivo)` → `POST /historial/ajuste`.
`useMutation` invalida `[QK.centros]`. Voluntarios: `cantidadTotal` solo-lectura.

`lib/api.ts`: `ajustarStock(centroId, insumoId, cantidad, motivo?)` vía `apiFetch`.

### 4.3 Tests
- `InventarioInicialForm`: no confirma item con nombre vacío; con `min=0` la cantidad
  puede llegar a 0; "Omitir" envía sin insumos.
- `InventarioResumen`: control "Ajustar" solo con `rol==="JEFE"`.

## 5. Seguridad / invariantes (preservar)
- `cantidadTotal` nunca se escribe directo; solo vía Historial dentro de transacción.
- Carga inicial y ajuste: solo JEFE (`JefeGuard` / autoridad de creador).
- AJUSTE no puede dejar stock negativo.
- Sin PII nueva en respuestas. Fingerprint solo por header `x-fingerprint`.
