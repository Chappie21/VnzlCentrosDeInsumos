# Carga de inventario inicial (CEN-20)

Cargar el stock que un centro **ya tiene** al momento de registrarlo, a mano o
importando un Excel/CSV. Es una operación de **una sola vez**: después, el
inventario solo se mueve por recepción (donaciones) y envíos.

## 1. Requerimientos
- Al crear un centro, poder declarar su inventario actual (acopios preexistentes).
- Carga rápida: importar una planilla `.xlsx`/`.csv`, no solo fila por fila.
- Que quede **auditado** y diferenciado de una donación.
- No debe convertirse en un editor de inventario permanente (rompería la trazabilidad).

## 2. Decisiones
- **Sin backend nuevo:** reusa `POST /historial/recibir` (upsert por nombre + Historial
  en transacción). El Excel es solo un atajo que **pre-llena la misma lista editable**.
- **Estado `INICIAL` en `Historial`:** nuevo `enum TipoMovimiento { INICIAL, DONACION, ENVIO, AJUSTE }`
  y campo `Historial.tipo` (default `DONACION`). Cada movimiento queda etiquetado:
  recepción → `DONACION`, envío → `ENVIO`, manual `+/-` → `AJUSTE`, carga inicial → `INICIAL`.
- **Una sola vez (enforced en el server):** `recibir` con `tipo=INICIAL` se rechaza
  (400) si el centro ya tiene movimientos. Así "solo al crear", no un backdoor para editar.
- **Única entrada en la UI:** botón "Cargar inventario inicial" en la pantalla de éxito
  al crear el centro. No se expone en el dashboard.
- **SheetJS (`xlsx`) con import dinámico:** lee `.xlsx` y `.csv` sin inflar el bundle.
  Plantilla `.csv` generada en el cliente (Blob), sin dependencia extra.

## 3. Diseño técnico
- **Parser puro** `lib/inventario-import.ts`: `parseInventarioRows(rows)` →
  `{ items, warnings }`. Tolera columnas en distinto orden/idioma (nombre/insumo,
  categoria/tipo, cantidad/cant…), mapea categoría por sinónimos a `CategoriaInsumo`
  (acentos/case-insensitive; lo no reconocido queda `null`), valida nombre y cantidad,
  acumula avisos sin tirar.
- **UI** `(app)/mis-centros/[centroId]/cargar`:
  - `CargaInventario`: lista editable (nombre · categoría · cantidad ±, agregar/quitar) +
    "Importar Excel/CSV" (dynamic import de `xlsx` → `sheet_to_json` → parser → pre-llena) +
    "Plantilla". Emite `DonationItem[]` vía `onConfirmar`.
  - `page.tsx`: postea con `cargaInicial(centroId, items)` (`tipo=INICIAL`) y muestra el
    resultado; surface del mensaje de error del server (ej. "ya tiene movimientos").
- **Backend** `historial.ts`: `RecibirDto.tipo?` (enum, default `DONACION`); enforcement
  `INICIAL` (count de `historial` del centro === 0); `tipo` se persiste en cada `Historial`.
  `envios.ts`: los movimientos `(-)` del despacho usan `tipo=ENVIO`.

## 4. Seguridad y edge cases
- Ruta y endpoint protegidos por `IdentidadGuard` + `VoluntarioGuard` (miembro del centro).
- `INICIAL` solo en centro sin movimientos → no se puede usar para alterar stock después.
- Filas inválidas del archivo (sin nombre, cantidad no numérica/<1) se omiten con aviso;
  categorías desconocidas quedan en blanco para elegir. El server revalida (cantidad ≥ 1, enum).
- Regla de oro intacta: `cantidadTotal` solo se mueve creando `Historial` dentro de la tx.

## 5. Verificación
- Unit: `inventario-import.test.ts` (7), `CargaInventario.test.tsx` (3),
  `historial.test.ts` (tipo por defecto DONACION, INICIAL permitido en centro vacío,
  INICIAL rechazado si hay movimientos), `envios.test.ts` (tipo ENVIO),
  `SuccessView.test.tsx` (botón "Cargar inventario inicial").
- Smoke: crear centro → "Cargar inventario inicial" → cargar (manual o Excel) → ver el centro.

## 6. Pendientes / deuda
- El editor de filas (nombre/categoría/cantidad) ya está duplicado en `DonacionForm`,
  `RecepcionList`, `EnvioForm` y `CargaInventario` — candidato a un `<ItemsEditor>` compartido.
- Backfill de `Historial.tipo` para filas previas a la migración (quedan en `DONACION` por default).
