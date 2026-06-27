# Flujo: Donar (donación por QR)

> Estado: implementado · Última actualización: 2026-06-27 · Branch/PR: `atenciomvictor/cen-8-donar-carrito-qr` (CEN-8)

## 1. Requerimientos iniciales
Del onboarding, el camino **"Quiero donar"**: el usuario ingresa lo que está donando
(cantidad, tipo de insumo, categoría) y genera un **código QR** que redirige/representa
esa donación para mostrarlo a un voluntario del centro, que lo escanea para registrar
los insumos. Debe ser visible en cualquier dispositivo.

## 2. Decisiones tomadas
- **QR stateless, por nombre.** El QR codifica la lista de insumos (`{v:1, items:[{n,c,q}]}`)
  con **nombre**, no `insumoId`. Por qué: el donante no pertenece a ningún centro, así que
  no puede conocer IDs de inventario. Alternativa descartada: crear una tabla `Donacion` y
  un ID — innecesario para el MVP, el QR se autodescribe.
- **Sin botón "Guardar"** (estaba en el mockup). Por qué: al ser stateless no hay borrador
  que persistir. Upgrade futuro marcado con `ponytail:` (localStorage + carga al montar).
- **Categorías como constante espejo** (`constants/categorias.ts`) del enum `CategoriaInsumo`,
  para no bundlear el cliente Prisma en el front.
- **Es un flujo enfocado**: oculta el `BottomNav` (no es una tab). Ver `NAV_HIDDEN_PREFIXES`.
- **QR generado con `qrcode.react`** (SVG, reusable por invitar/envíos).

## 3. Diseño técnico
- **Frontend**
  - Ruta: `app/(app)/donar/page.tsx` — gate de identidad (si no hay identidad en
    localStorage ni en backend, redirige a `/?next=/donar`).
  - Componente: `app/(app)/donar/_components/DonacionForm.tsx` — carrito (nombre, categoría
    `<select>`, cantidad con stepper ±), total de unidades en vivo, "Generar QR y Donar" →
    pantalla "Listo para entregar" con `<Qr>` + resumen.
  - Lógica pura: `app/lib/donation.ts` — `encodeDonation` / `decodeDonation` / `totalUnidades`.
  - Compartidos: `app/_components/Qr.tsx`, `constants/categorias.ts`.
  - Entrada: botón **"Quiero Donar"** en el onboarding (`app/page.tsx`), tanto en el form
    como en la vista de perfil ya identificado.
- **Backend**: ninguno nuevo para generar el QR (es client-side). El onboarding usa el
  `POST /usuarios/onboard` existente.
- **Datos**: el QR no escribe en DB. El registro ocurre en el flujo de **Recepción** (CEN-12)
  vía `POST /historial/batch`.

## 4. Seguridad y edge cases
- `decodeDonation` valida: JSON parseable, versión soportada, lista no vacía, nombre no vacío,
  cantidad entera ≥ 1, categoría dentro del enum o `null`. Lanza error claro si no.
- Donar exige identidad completa (gate en `page.tsx`); "solo observar" no llega acá.
- Claves cortas (`n/c/q`) para limitar la densidad del QR con donaciones grandes.

## 5. Verificación
- Unit (TDD): `donation.test.ts` (10), `Qr.test.tsx` (1), `DonacionForm.test.tsx` (3),
  `TopAppBar.test.tsx` y `BottomNav.test.tsx` (entrada/visibilidad). Suite web 40/40.
- `tsc --noEmit` limpio, `next build` OK.
- Smoke manual (Chrome): onboarding 3 caminos → donar → QR con resumen; navbar oculto en
  `/donar`; burger → "Volver al inicio".
- Responsive: a 390px sin overflow horizontal; título del header con `truncate` (no se parte
  ni desborda en anchos ≤320).

## 6. Pendientes / deuda
- **CEN-12 (Recepción)**: el QR viaja por **nombre**, así que el escaneo debe hacer *upsert
  de insumos por nombre* antes de incrementar. El `POST /historial/batch` actual exige
  `insumoId` existentes del centro → falta ese endpoint/variante.
- Botón "Guardar" borrador (deferido, ver `ponytail:` en `DonacionForm.tsx`).
