# Flujo: Recepción de donación por escaneo

> Estado: implementado · Última actualización: 2026-06-27 · Branch/PR: `atenciomvictor/cen-12-escaneo` (CEN-12). Depende de CEN-19.

## 1. Requerimientos iniciales
Cuando un voluntario escanea el QR de una donación, los insumos se registran en el inventario
de su centro de acopio (img 9, 10, 11). El centro al que se recibe debe quedar fijado por el
**contexto del voluntario que escanea**, nunca elegido a mano al escanear (evita error humano).

## 2. Decisiones tomadas
- **Centro siempre por contexto (URL `?centro=<id>`), sin dropdown al escanear.** Por qué: evitar
  que se ingrese a un centro equivocado. Alternativa descartada: selector de centro al escanear.
- **Tab global "Escanear" auto-resuelve** con `GET /centros/mios`: 1 centro → `/scanning?centro=ID`;
  varios → redirige a Mi Centro a elegir; 0 → aviso. (función pura `resolveScanTarget`).
- **Backend por nombre** (`POST /historial/recibir`, CEN-19): el QR trae nombres, no `insumoId`.
- **Validar antes de ingresar**: cada item escaneado tiene un toggle "Validar"; solo los validados
  se ingresan (accountability de la recepción física).
- **Cámara**: `html5-qrcode` con import dinámico (no SSR); si no hay permiso/cámara, fallback sin romper.

## 3. Diseño técnico
- **Frontend**
  - Ruta: `app/(app)/scanning/page.tsx` — resuelve centro por contexto, orquesta fases
    (loading → scan → review → done | none).
  - `_components/QrScanner.tsx` — cámara (html5-qrcode), `onScan(text)`.
  - `_components/RecepcionList.tsx` — lista con validar/editar cantidad/quitar + resumen + confirmar.
  - Lógica pura: `app/lib/recepcion.ts` — `fromDonation`, `buildRecibirItems`, `recepcionResumen`,
    `resolveScanTarget`. Decodificación con `lib/donation.decodeDonation`.
  - API: `lib/api.ts` → `getMisCentros()`, `recibirDonacion(centroId, items)`.
  - Entrada desde Mi Centro (vista de Andrés): botón "Escanear donación" → `/scanning?centro=<id>`.
- **Backend**: `POST /historial/recibir` (CEN-19) — upsert por (centroId, nombre) + Historial(+),
  transacción, solo voluntario del centro.

## 4. Seguridad y edge cases
- `resolveScanTarget` verifica pertenencia: si el `?centro=` no es del voluntario → estado "none".
- El backend reverifica con `VoluntarioGuard` (no se confía en el front).
- QR inválido / no-donación → mensaje, no rompe el escaneo.
- Sin cámara/permiso → fallback. Sin validados → "Confirmar" deshabilitado.

## 5. Verificación
- Unit (TDD): `recepcion.test.ts` (10: resumen, payload, resolveScanTarget), `RecepcionList.test.tsx`
  (5). Suite web 69/69, `tsc` limpio, `next build` OK (`/scanning`).
- Smoke (Chrome): `/scanning` auto-resuelve a `?centro=ID` con 1 centro y muestra "Recepción en
  <centro>"; estado "none" si no sos voluntario. (La cámara no corre en headless.)
- Backend `recibir` e2e-verificado en CEN-19.

## 6. Pendientes / deuda
- Depende de **CEN-19** (`/historial/recibir`) en dev para funcionar end-to-end (PR #11).
- ID de transacción visible (TRX-...) del mockup: el backend hoy devuelve `{ ok, recibidos }`;
  si se quiere un ID, agregarlo en `recibir`.
