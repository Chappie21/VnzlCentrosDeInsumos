# Flujo: Onboarding e identidad

> Estado: implementado · Última actualización: 2026-06-27 · Branch/PR: CEN-6 (+ 3er camino en CEN-8)

## 1. Requerimientos iniciales
Pantalla inicial donde el usuario ingresa sus datos (nombre, cédula, teléfono) y elige uno de
tres caminos: **Quiero Donar**, **Entrar y Ayudar** o **Solo quiero observar** (img 1). Identidad
**sin login**.

## 2. Decisiones tomadas
- **Identidad sin login por `fingerprint`** (UUID en localStorage, header `x-fingerprint`). Por qué:
  cero fricción en emergencia. El onboarding (nombre/cédula/teléfono) es obligatorio antes de
  contribuir; "solo observar" usa un fingerprint anónimo.
- **3 caminos desde un mismo form**: "Quiero Donar" y "Entrar y Ayudar" envían el onboarding y
  divergen el destino (donar vs perfil/centros); "Solo observar" marca anónimo y no exige datos.
- **react-hook-form** con un resolver que reusa las reglas del backend (`validateOnboarding`).
- **Rehidratación**: si se limpió localStorage pero el dispositivo ya hizo onboarding, se recupera
  la identidad desde el backend (`GET /usuarios/me`).
- **Gating con `?next=`**: una acción que exige identidad redirige a `/?next=<ruta>` y vuelve al
  completar.

## 3. Diseño técnico
- **Frontend**
  - Ruta: `app/page.tsx` — `Home` resuelve identidad al montar (localStorage → backend) y muestra
    `OnboardingForm` o `ProfileView`.
  - `OnboardingForm`: campos con `Field` + react-hook-form; botones Quiero Donar / Entrar y Ayudar /
    Solo observar.
  - Estado/identidad: `app/lib/identity.ts` — `getIdentity`, `setIdentity`, `setAnon`,
    `hasFullIdentity`, `isAnon`, `syncIdentity`, `requireHelp`.
  - Validación: `app/lib/validate.ts` (`validateOnboarding`, `normalizeCedula`, `normalizeTelefono`).
  - Cliente: `app/lib/api.ts` → `onboard(body)`, `getMe()`.
- **Backend**
  - `POST /usuarios/onboard` — guarda nombre/cédula/teléfono contra el fingerprint.
  - `GET /usuarios/me` — devuelve la identidad del fingerprint + `identidadCompleta`.
- **Datos**: modelo `Usuario` (PK `fingerprint`, nombre/cédula/teléfono nullable).

## 4. Seguridad y edge cases
- Toda request lleva `x-fingerprint` (lo exige `fingerprintOf` en el backend).
- Acciones de contribución usan `IdentidadGuard` (identidad completa) — no se confía solo en el front.
- "Solo observar" no escribe identidad; las rutas de operador se ocultan para anónimos.
- Validación alineada front/back (mismas reglas) para evitar divergencias.

## 5. Verificación
- Unit: `validate.test.ts`, `fingerprint.test.ts` (web) y tests de `usuarios` (api).
- Smoke: completar datos → cada botón rutea a su flujo; "solo observar" entra sin datos.

## 6. Pendientes / deuda
- Sin recuperación de identidad entre dispositivos (es por dispositivo, por diseño).
