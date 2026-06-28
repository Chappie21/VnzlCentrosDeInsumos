# Flujo: Envíos (descargo / despacho)

> Estado: implementado · Última actualización: 2026-06-27 · Branch/PR: CEN-16 (backend) + CEN-17 (UI). Depende: CEN-16.

## 1. Requerimientos iniciales
Un centro de acopio despacha insumos a otro lado (otro centro o un albergue) y genera una
**guía de envío con QR** (img 13). El QR abre una página pública con la info de la guía.

## 2. Decisiones tomadas
- **Solo despacho**: el envío descuenta el inventario del **origen** (vía `Historial(-)`); el
  destino NO suma automático. Alternativa descartada: ciclo con recepción en destino (fuera de MVP).
- **Destino = centro de la red (FK) XOR texto libre** (albergue). Cubre destinos fuera de la red.
- **Transporte/chofer = texto libre** (sin entidad nueva).
- **Quién despacha**: cualquier voluntario del origen, **pero queda registrado** (`Envio.creadoPorId`
  además del `usuarioId` de cada `Historial`).
- **Items por `insumoId`**: el que despacha ve su propio inventario (a diferencia del donante, que va por nombre).
- **Centro origen por contexto**: la UI se abre desde Mi Centro con `?centro=<id>`; no se elige a mano.
- **QR** con `qrcode.react` apuntando a `/guia/:id` (página pública, CEN-18).

## 3. Diseño técnico
- **Backend** (CEN-16)
  - `model Envio` (centroOrigenId, centroDestinoId? | destinoTexto?, transporte, creadoPorId, creadoEn)
    + `Historial.envioId` + back-relations.
  - `POST /envios` — `IdentidadGuard` + `VoluntarioGuard` (sobre `centroId` = origen). Valida destino
    (centro XOR texto), pertenencia de insumos y stock; agrupa por insumo; transacción todo-o-nada
    (crea Envio + `Historial(-)` por insumo + `decrement` de `cantidadTotal`). `bumpCentros()`.
  - `GET /envios/:id` — guía pública (origen, destino, items, transporte, despachadoPor). Sin auth.
- **Frontend** (CEN-17)
  - Ruta `(full)/envios/nuevo/page.tsx` (full-screen, sin bottom-nav). Origen por `?centro=<id>`.
  - Form: destino (toggle centro `<select>` / texto), insumos del origen con stepper (0..stock),
    transporte. "Generar Guía de Envío" → `POST /envios` → pantalla "Envío confirmado" con `<Qr>`
    (`/guia/:id`), ID, resumen (destino, bultos) y "Descargar QR" (SVG).
  - Lógica pura: `lib/envio.ts` (`buildEnvioItems`, `totalBultos`, `envioValido`).
  - API: `lib/api.ts` → `crearEnvio`, `getCentrosSelect`.

## 4. Seguridad y edge cases
- `VoluntarioGuard` (backend) asegura que solo voluntarios del origen despachen; el front no decide permisos.
- Stock validado en el server (400 si falta) y en el front (`envioValido`, cap por stock en el stepper).
- Destino XOR validado en ambos lados.
- `getCentrosSelect` trae máx 50 (tope del backend); si crecen los centros, paginar (ver `ponytail:`).

## 5. Verificación
- Backend: `envios.test` (12). Suite api 34/34. e2e: despacha 4 → stock 10→6; guía pública sin auth;
  400 sin stock; 403 sin ser voluntario.
- Frontend: `envio.test` (9). Suite web 80/80, `tsc` limpio, `next build` OK (`/envios/nuevo`).
  Smoke Chrome: el form carga con origen por contexto, inventario y selector de destino.

## 6. Pendientes / deuda
- **CEN-18**: página pública `/guia/:id` (a la que apunta el QR) — issue aparte.
- Entrada desde **Mi Centro**: agregar botón "Nuevo Envío" → `/envios/nuevo?centro=<id>` (coordinar con
  la vista de Andrés).
- "Descargar QR" exporta el SVG; si se quiere PNG/PDF, convertir vía canvas.
