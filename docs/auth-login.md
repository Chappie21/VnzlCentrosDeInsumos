# Flujo: Login con contraseña + Google

> Estado: borrador · Última actualización: 2026-06-28 · Branch/PR: por crear
> Plan de implementación detallado: [`superpowers/plans/2026-06-28-login-password-google.md`](superpowers/plans/2026-06-28-login-password-google.md)

## 1. Requerimientos iniciales

Agregar uso de contraseña para poder usar la app en distintos dispositivos:
- Login: remover inputs de teléfono y nombre, dejar solo cédula y contraseña.
- Vista de registro: nombre, cédula, teléfono y contraseña.
- Botón de registro/login con Google. Tras un registro Google exitoso, pedir cédula y teléfono para completar el usuario.
- En cualquier método de registro, el usuario queda autenticado (recibe su JWT).
- Revisar migraciones DB, los guards (hoy por fingerprint, pasan a JWT) y que el JWT de invitaciones no genere conflicto.

## 2. Decisiones tomadas

- **PK de Usuario → `id` uuid; migrar las 3 FKs** (Voluntario, Historial, Envio). Antes el PK era el device `fingerprint`; con login multi-dispositivo el usuario debe resolverse igual en cualquier equipo. Alternativa descartada: mantener `fingerprint` como id opaco (menos churn, pero PK semánticamente confuso).
- **Reset de DB en dev** (`db push --force-reset` + seed). Proyecto temprano; sin ruta de reclamo para usuarios anónimos viejos.
- **Google: verificar ID token con `google-auth-library` + emitir JWT propio.** Alternativa descartada: NextAuth/Auth.js (choca con el esquema JWT propio, dos sistemas de sesión).
- **Navegación anónima conservada**: rutas públicas (mapa) sin login; JWT solo para acciones.
- **Un solo `JWT_SECRET`, tokens distinguidos por claim `typ`** (`user`/`invite`/`admin`).

## 3. Diseño técnico

- **Frontend**: login solo cédula+contraseña (`page.tsx`); nueva ruta `/registro`; botón Google (`@react-oauth/google`) + `/completar-perfil`; `apiFetch` manda `Authorization: Bearer`; token en `localStorage["token"]`.
- **Backend**: `POST /auth/register`, `/auth/login`, `/auth/google` (todos emiten JWT). Guards `Identidad/Voluntario/Jefe` verifican Bearer y setean `req.userId`. Nuevo `SesionGuard` para completar perfil. `onboard`/`me` por `id`.
- **Datos**: `Usuario { id, cedula @unique, passwordHash?, googleId? @unique, email? @unique, ... }`. FKs → `Usuario.id`.

## 4. Seguridad y edge cases

- Claim `typ` obligatorio y validado en cada verificador → invitación no pasa como sesión ni como admin; `accept()` ahora exige `typ:"invite"`.
- `cedula @unique` permite múltiples NULL → usuarios Google sin cédula coexisten hasta completar perfil. Login exige `passwordHash` presente.
- `/auth/*` bajo `RateLimitGuard` (anti fuerza bruta), keyed por `x-fingerprint`||IP.
- Contraseña mínimo 8, hash bcryptjs.

## 5. Verificación

- Unit (TDD): `jwt-session.spec`, `guards.spec`, `auth.service.spec` (register/login/google).
- Smoke: cuenta semilla `V0000000`/`seed1234` entra; registro nuevo recibe token; flujo Google → `needsProfile` → completar perfil → acceso a acciones guarded.

## 6. Pendientes / deuda

- Sin ruta de reclamo para cuentas anónimas previas al reset.
- Usuarios solo-Google sin contraseña no pueden hacer login por cédula hasta fijar una (no contemplado un "set password" todavía).
