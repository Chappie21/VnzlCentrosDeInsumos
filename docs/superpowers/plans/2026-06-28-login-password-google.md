# Login con Contraseña + Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la autenticación de usuario de "device fingerprint" a credenciales reales (cédula + contraseña) con JWT de sesión, agregar vista de registro y registro/login con Google, de modo que el usuario quede autenticado (con JWT) sin importar el método.

**Architecture:** El backend deja de identificar al usuario por el header `x-fingerprint` y pasa a verificar un JWT de sesión (`typ:"user"`, `sub:Usuario.id`). `Usuario` gana PK `id` (uuid), columnas de credenciales (`passwordHash`, `googleId`, `email`) y `cedula @unique`; las 3 FKs (Voluntario, Historial, Envio) se migran de `fingerprint` a `id`. Tres endpoints nuevos (`/auth/register`, `/auth/login`, `/auth/google`) emiten el JWT. Los guards (`IdentidadGuard`, `VoluntarioGuard`, `JefeGuard`) se reescriben para resolver al usuario desde el JWT. Las invitaciones de voluntario y la sesión admin reciben claims `typ` distintos para evitar confusión de tokens. El frontend cambia el almacenamiento de identidad por un `token` y manda `Authorization: Bearer`; las rutas públicas (mapa) siguen sin auth.

**Tech Stack:** NestJS (apps/api), Next.js App Router (apps/web), Prisma 7 + PostgreSQL (packages/database), `@nestjs/jwt`, `bcryptjs` (ya presente), `google-auth-library` (nueva, API), `@react-oauth/google` (nueva, web).

## Global Constraints

- **DB workflow:** `prisma db push` (sin migration files). Reset de DB permitido en dev: `pnpm db:push --force-reset && pnpm db:seed`.
- **PK del usuario:** `Usuario.id String @id @default(uuid())`. Las relaciones `Voluntario.usuarioId`, `Historial.usuarioId`, `Envio.creadoPorId` referencian `Usuario.id`.
- **Secreto JWT:** un único `process.env.JWT_SECRET` para todos los tokens; se distinguen por claim `typ`. Valores: sesión usuario `typ:"user"`, invitación `typ:"invite"`, admin `typ:"admin"` (ya existe).
- **Expiración sesión usuario:** `30d` (multi-dispositivo, conveniencia móvil).
- **Normalización cédula/teléfono:** reutilizar las funciones existentes en `apps/api/src/usuarios.ts` (regex cédula `/^[VE]\d{6,9}$/`, teléfono venezolano). NO duplicar.
- **Contraseña:** mínimo 8 caracteres; hash con `bcryptjs` (`hash`/`compare`), reutilizando el patrón de `apps/api/src/admin.ts`.
- **Navegación anónima:** rutas públicas (mapa de centros, login, registro) accesibles sin token. El header `x-fingerprint` se conserva SOLO para `RateLimitGuard` (anti-abuso); ya no es identidad.
- **Env nuevas:** `GOOGLE_CLIENT_ID` (API), `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web). Documentar en `.env.example`.

---

### Task 1: Schema — PK `id`, columnas de credenciales, migración de FKs, reset + seed

**Files:**
- Modify: `packages/database/prisma/schema.prisma:11-26` (model Usuario), `:82` (Voluntario rel), `:168` (Historial rel), `:189` (Envio rel)
- Modify: `packages/database/prisma/seed.ts`

**Interfaces:**
- Produces: `Usuario { id, nombre?, cedula? @unique, telefono?, passwordHash?, googleId? @unique, email? @unique, cedulaVerificada?, cedulaNombre?, cedulaVerificadaEn? }`. FKs apuntan a `Usuario.id`.

- [ ] **Step 1: Reescribir el model Usuario**

```prisma
model Usuario {
  id           String  @id @default(uuid())
  nombre       String?
  cedula       String? @unique // identificador de login; null hasta completar perfil (Google)
  telefono     String?
  passwordHash String? // null para usuarios solo-Google que no fijaron contraseña
  googleId     String? @unique // sub del ID token de Google
  email        String? @unique // email verificado de Google

  // Validación de cédula contra api.cedula.com.ve (CEN-23).
  cedulaVerificada   Boolean?
  cedulaNombre       String?
  cedulaVerificadaEn DateTime?

  centros       Voluntario[]
  movimientos   Historial[]
  enviosCreados Envio[]
}
```

- [ ] **Step 2: Apuntar las 3 FKs a `Usuario.id`**

En `Voluntario` (línea ~82):
```prisma
  usuario Usuario @relation(fields: [usuarioId], references: [id])
```
En `Historial` (línea ~168):
```prisma
  usuario Usuario @relation(fields: [usuarioId], references: [id])
```
En `Envio` (línea ~189):
```prisma
  creadoPor   Usuario     @relation(fields: [creadoPorId], references: [id])
```

- [ ] **Step 3: Actualizar el seed**

En `seed.ts`, el Usuario sembrado usaba `fingerprint: "seed-fingerprint"`. Cambiar a:
```typescript
const seedUser = await prisma.usuario.upsert({
  where: { cedula: "V0000000" },
  update: {},
  create: {
    nombre: "Usuario Semilla",
    cedula: "V0000000",
    telefono: "04140000000",
    // contraseña "seed1234" hasheada — solo dev
    passwordHash: await hash("seed1234", 10),
  },
});
```
Importar `import { hash } from "bcryptjs";` en el seed. Donde el seed referenciaba `usuarioId: "seed-fingerprint"` en Voluntario/Historial, usar `usuarioId: seedUser.id`.

- [ ] **Step 4: Regenerar cliente + reset DB**

Run: `pnpm db:generate && pnpm db:push --force-reset && pnpm db:seed`
Expected: push aplica el schema nuevo sin error; seed corre idempotente. Verificar tabla: `Usuario` tiene columnas `id, passwordHash, googleId, email` y `cedula` con índice único.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/seed.ts
git commit -m "feat(db): Usuario con id PK + credenciales (password/google), migra FKs"
```

---

### Task 2: Backend — helpers de JWT de sesión + claims `typ` + fix de invitación

**Files:**
- Create: `apps/api/src/auth/jwt-session.ts`
- Modify: `apps/api/src/usuarios.ts` (invitación: `invite()` y `accept()`)
- Test: `apps/api/src/auth/jwt-session.spec.ts`

**Interfaces:**
- Produces:
  - `signUserToken(jwt: JwtService, userId: string): Promise<string>` — firma `{sub:userId, typ:"user"}` exp `30d`.
  - `verifyUserToken(jwt: JwtService, token: string): Promise<string>` — verifica firma + `typ==="user"`, devuelve `sub`; lanza `UnauthorizedException` si falla.
- Consumes (de Task 1): `Usuario.id`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// apps/api/src/auth/jwt-session.spec.ts
import { JwtService } from "@nestjs/jwt";
import { signUserToken, verifyUserToken } from "./jwt-session";

const jwt = new JwtService({ secret: "test-secret" });

describe("jwt-session", () => {
  it("firma y verifica un token de usuario", async () => {
    const t = await signUserToken(jwt, "user-123");
    expect(await verifyUserToken(jwt, t)).toBe("user-123");
  });

  it("rechaza un token con typ distinto de user", async () => {
    const invite = await jwt.signAsync({ centroId: "c1", typ: "invite" });
    await expect(verifyUserToken(jwt, invite)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test (falla)**

Run: `pnpm --filter @vnzl/api test jwt-session`
Expected: FAIL — módulo `./jwt-session` no existe.

- [ ] **Step 3: Implementar**

```typescript
// apps/api/src/auth/jwt-session.ts
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";

const USER_TTL = "30d";

export function signUserToken(jwt: JwtService, userId: string): Promise<string> {
  return jwt.signAsync({ sub: userId, typ: "user" }, { expiresIn: USER_TTL });
}

export async function verifyUserToken(jwt: JwtService, token: string): Promise<string> {
  let payload: any;
  try {
    payload = await jwt.verifyAsync(token);
  } catch {
    throw new UnauthorizedException("Sesión inválida o expirada");
  }
  if (payload?.typ !== "user" || !payload?.sub)
    throw new UnauthorizedException("No es una sesión de usuario");
  return payload.sub;
}
```

- [ ] **Step 4: Endurecer invitación con `typ:"invite"`**

En `apps/api/src/usuarios.ts`, `invite()` (línea ~90):
```typescript
invite(centroId: string) {
  const token = this.jwt.sign(
    { centroId, typ: "invite" },
    { expiresIn: INVITACION.expiresIn },
  );
  return { token, expiresInMin: INVITACION.ttlMin };
}
```
En `accept()` (línea ~98), validar `typ`:
```typescript
async accept(userId: string, token: string) {
  let payload: any;
  try {
    payload = this.jwt.verify(token);
  } catch {
    throw new UnauthorizedException("Invitación inválida o expirada");
  }
  if (payload?.typ !== "invite" || !payload?.centroId)
    throw new UnauthorizedException("Token no es una invitación");
  const centroId: string = payload.centroId;
  await prisma.voluntario.upsert({
    where: { usuarioId_centroId: { usuarioId: userId, centroId } },
    update: {},
    create: { usuarioId: userId, centroId },
  });
  const centro = await prisma.centro.findUnique({
    where: { id: centroId },
    select: { nombre: true },
  });
  return { centroId, nombre: centro?.nombre ?? null };
}
```
(El parámetro `fingerprint` pasa a llamarse `userId`; el controller lo proveerá desde el JWT — Task 3.)

- [ ] **Step 5: Correr test (pasa)**

Run: `pnpm --filter @vnzl/api test jwt-session`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/jwt-session.ts apps/api/src/auth/jwt-session.spec.ts apps/api/src/usuarios.ts
git commit -m "feat(api): JWT de sesión de usuario + claim typ:invite en invitaciones"
```

---

### Task 3: Backend — reescribir guards de fingerprint a JWT

**Files:**
- Modify: `apps/api/src/guards.ts:17-77` (`fingerprintOf`, IdentidadGuard, VoluntarioGuard, JefeGuard)
- Modify: controllers que leían `fingerprintOf(req)`: `usuarios.ts:120-138`, `centros.ts`, `historial.ts`, `insumos.ts`, `envios.ts`
- Test: `apps/api/src/guards.spec.ts`

**Interfaces:**
- Consumes: `verifyUserToken` (Task 2).
- Produces:
  - `userIdOf(req): string` — lee `req.userId` (puesto por el guard); lanza si ausente.
  - Guards inyectan `JwtService`, verifican Bearer, setean `req.userId`.

- [ ] **Step 1: Escribir test que falla**

```typescript
// apps/api/src/guards.spec.ts
import { JwtService } from "@nestjs/jwt";
import { VoluntarioGuard } from "./guards";

const jwt = new JwtService({ secret: "test-secret" });
function ctx(headers: Record<string, string>, body: any = {}) {
  const req: any = { headers, body, header: (h: string) => headers[h.toLowerCase()] };
  return { switchToHttp: () => ({ getRequest: () => req }), _req: req } as any;
}

it("VoluntarioGuard rechaza sin Bearer", async () => {
  const g = new VoluntarioGuard(jwt);
  await expect(g.canActivate(ctx({}))).rejects.toThrow();
});
```

- [ ] **Step 2: Correr (falla)**

Run: `pnpm --filter @vnzl/api test guards`
Expected: FAIL — constructor de `VoluntarioGuard` aún no acepta `JwtService` / no lanza como se espera.

- [ ] **Step 3: Reescribir `guards.ts`**

Reemplazar `fingerprintOf` por extracción de Bearer + verificación, y setear `req.userId`:
```typescript
import { verifyUserToken } from "./auth/jwt-session";

function bearer(req: any): string {
  const auth: string = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new UnauthorizedException("Sesión requerida");
  return token;
}

export function userIdOf(req: any): string {
  if (!req.userId) throw new UnauthorizedException("Sesión requerida");
  return req.userId;
}

@Injectable()
export class IdentidadGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const u = await prisma.usuario.findUnique({ where: { id: req.userId } });
    if (!identidadCompleta(u))
      throw new ForbiddenException("Completa tu identidad para realizar esta acción");
    return true;
  }
}

@Injectable()
export class VoluntarioGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const centroId = req.body?.centroId ?? req.params?.centroId;
    if (!centroId) throw new BadRequestException("centroId requerido");
    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: req.userId, centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");
    return true;
  }
}

@Injectable()
export class JefeGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    const centroId = req.params?.centroId ?? req.body?.centroId;
    if (!centroId) throw new BadRequestException("centroId requerido");
    const link = await prisma.voluntario.findUnique({
      where: { usuarioId_centroId: { usuarioId: req.userId, centroId } },
    });
    if (!link) throw new ForbiddenException("No eres voluntario de este centro");
    if (link.rol !== RolVoluntario.JEFE)
      throw new ForbiddenException("Solo el jefe del centro puede hacer esto");
    return true;
  }
}
```
`identidadCompleta(u)` sigue chequeando `nombre && cedula && telefono`. `RateLimitGuard` queda igual (sigue usando `x-fingerprint` || `req.ip`).

- [ ] **Step 4: Actualizar controllers — `fingerprintOf(req)` → `userIdOf(req)`**

En cada endpoint guarded, reemplazar el argumento. Ejemplos:
- `usuarios.ts:120` `me(@Req() req)` → `this.service.me(userIdOf(req))`.
- `usuarios.ts:138` aceptar invitación → `this.service.accept(userIdOf(req), dto.token)`.
- `centros.ts`, `historial.ts`, `insumos.ts`, `envios.ts`: mismo reemplazo en cada handler que llamaba `fingerprintOf(req)`.
Importar `userIdOf` desde `./guards` donde antes se importaba `fingerprintOf`. Eliminar el export de `fingerprintOf`.

- [ ] **Step 5: Correr build + test**

Run: `pnpm --filter @vnzl/api build && pnpm --filter @vnzl/api test guards`
Expected: compila sin referencias a `fingerprintOf`; test PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/guards.ts apps/api/src/guards.spec.ts apps/api/src/usuarios.ts apps/api/src/centros.ts apps/api/src/historial.ts apps/api/src/insumos.ts apps/api/src/envios.ts
git commit -m "feat(api): guards resuelven usuario por JWT de sesión (no fingerprint)"
```

---

### Task 4: Backend — endpoints `/auth/register` y `/auth/login`

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/dto.ts`
- Modify: `apps/api/src/app.module.ts` (registrar controller + provider)
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `signUserToken` (Task 2), normalizadores de cédula/teléfono (de `usuarios.ts` — exportarlos si no lo están).
- Produces:
  - `POST /auth/register {nombre, cedula, telefono, password}` → `{token, usuario}`.
  - `POST /auth/login {cedula, password}` → `{token, usuario}`.

- [ ] **Step 1: Test que falla (register + login round-trip)**

```typescript
// apps/api/src/auth/auth.service.spec.ts
// Mockear prisma.usuario (findUnique/create) y validar:
//  - register hashea password, crea usuario, devuelve token verificable
//  - login con password correcta devuelve token; con incorrecta lanza Unauthorized
//  - cedula duplicada en register lanza ConflictException
```
(Escribir el spec con un mock simple de `prisma` y un `JwtService` real con secreto de test, afirmando `verifyUserToken(jwt, res.token) === usuario.id`.)

- [ ] **Step 2: Correr (falla)**

Run: `pnpm --filter @vnzl/api test auth.service`
Expected: FAIL — `auth.service` no existe.

- [ ] **Step 3: DTOs**

```typescript
// apps/api/src/auth/dto.ts
import { IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString() nombre!: string;
  @IsString() cedula!: string;
  @IsString() telefono!: string;
  @IsString() @MinLength(8) password!: string;
}
export class LoginDto {
  @IsString() cedula!: string;
  @IsString() password!: string;
}
```

- [ ] **Step 4: Service**

```typescript
// apps/api/src/auth/auth.service.ts
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, compare } from "bcryptjs";
import { prisma } from "@vnzl/database";
import { signUserToken } from "./jwt-session";
import { normalizarCedula, normalizarTelefono } from "../usuarios"; // exportar desde usuarios.ts
import { RegisterDto, LoginDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const cedula = normalizarCedula(dto.cedula);
    const telefono = normalizarTelefono(dto.telefono);
    const existe = await prisma.usuario.findUnique({ where: { cedula } });
    if (existe) throw new ConflictException("Ya existe una cuenta con esa cédula");
    const usuario = await prisma.usuario.create({
      data: { nombre: dto.nombre.trim(), cedula, telefono, passwordHash: await hash(dto.password, 10) },
    });
    return { token: await signUserToken(this.jwt, usuario.id), usuario: this.publico(usuario) };
  }

  async login(dto: LoginDto) {
    const cedula = normalizarCedula(dto.cedula);
    const usuario = await prisma.usuario.findUnique({ where: { cedula } });
    if (!usuario?.passwordHash || !(await compare(dto.password, usuario.passwordHash)))
      throw new UnauthorizedException("Cédula o contraseña inválida");
    return { token: await signUserToken(this.jwt, usuario.id), usuario: this.publico(usuario) };
  }

  private publico(u: any) {
    return {
      id: u.id, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono,
      identidadCompleta: Boolean(u.nombre && u.cedula && u.telefono),
    };
  }
}
```
Nota: `normalizarCedula`/`normalizarTelefono` viven hoy inline en `usuarios.ts` (validación del OnboardDto). Extraerlas a funciones exportadas y reutilizarlas (DRY) — no reescribir las regex.

- [ ] **Step 5: Controller + módulo**

```typescript
// apps/api/src/auth/auth.controller.ts
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { RateLimitGuard } from "../guards";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post("register")
  register(@Body() dto: RegisterDto) { return this.service.register(dto); }

  @UseGuards(RateLimitGuard)
  @Post("login")
  login(@Body() dto: LoginDto) { return this.service.login(dto); }
}
```
Registrar `AuthController` y `AuthService` en `app.module.ts`.

- [ ] **Step 6: Correr (pasa) + build**

Run: `pnpm --filter @vnzl/api test auth.service && pnpm --filter @vnzl/api build`
Expected: PASS + compila.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/ apps/api/src/app.module.ts apps/api/src/usuarios.ts
git commit -m "feat(api): registro y login por cédula+contraseña con JWT"
```

---

### Task 5: Backend — endpoint `/auth/google`

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts` (método `google`), `apps/api/src/auth/auth.controller.ts` (ruta), `apps/api/src/auth/dto.ts` (GoogleDto)
- Modify: `apps/api/package.json` (dep `google-auth-library`)
- Test: `apps/api/src/auth/auth.service.spec.ts` (caso google con verificador mockeado)

**Interfaces:**
- Produces: `POST /auth/google {idToken}` → `{token, usuario, needsProfile:boolean}`.
- `needsProfile = !identidadCompleta` (Google da nombre+email pero no cédula/teléfono).

- [ ] **Step 1: Instalar dep**

Run: `pnpm --filter @vnzl/api add google-auth-library`
Expected: agregada a `apps/api/package.json`.

- [ ] **Step 2: Test que falla**

```typescript
// añadir a auth.service.spec.ts
// Inyectar un verificador de token falso que devuelve {sub:"g1", email:"a@b.com", name:"Ana"}.
// Afirmar: primer google() crea usuario con googleId="g1", needsProfile=true;
// segundo google() con mismo sub reusa el usuario (no duplica).
```

- [ ] **Step 3: Implementar `google()`**

```typescript
// auth.service.ts — añadir
import { OAuth2Client } from "google-auth-library";

private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async google(idToken: string) {
  const ticket = await this.googleClient.verifyIdToken({
    idToken, audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new UnauthorizedException("Token de Google inválido");

  let usuario = await prisma.usuario.findUnique({ where: { googleId: p.sub } });
  if (!usuario) {
    // enlazar por email si ya existía cuenta con ese email, si no crear
    usuario = await prisma.usuario.upsert({
      where: { email: p.email },
      update: { googleId: p.sub },
      create: { googleId: p.sub, email: p.email, nombre: p.name ?? null },
    });
  }
  const u = this.publico(usuario);
  return { token: await signUserToken(this.jwt, usuario.id), usuario: u, needsProfile: !u.identidadCompleta };
}
```
ponytail: el `OAuth2Client` se inyecta como campo; en el spec se sobreescribe con un doble. // ponytail: cliente real en runtime, mock en test.

- [ ] **Step 4: DTO + ruta**

```typescript
// dto.ts
export class GoogleDto { @IsString() idToken!: string; }
```
```typescript
// auth.controller.ts
@UseGuards(RateLimitGuard)
@Post("google")
google(@Body() dto: GoogleDto) { return this.service.google(dto.idToken); }
```

- [ ] **Step 5: Correr (pasa) + build**

Run: `pnpm --filter @vnzl/api test auth.service && pnpm --filter @vnzl/api build`
Expected: PASS + compila.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/ apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): registro/login con Google (verifica ID token) + JWT"
```

---

### Task 6: Backend — completar perfil (`onboard` por JWT) + `me`

**Files:**
- Modify: `apps/api/src/usuarios.ts` (`onboard()` y `me()` usan `userId`, no fingerprint)

**Interfaces:**
- Consumes: `userIdOf(req)` (Task 3).
- Produces: `POST /usuarios/onboard {nombre?, cedula?, telefono?}` actualiza por `id` (para que el usuario de Google complete cédula+teléfono); `GET /usuarios/me` devuelve por `id`.

- [ ] **Step 1: Reescribir `onboard()` y `me()`**

```typescript
async onboard(userId: string, dto: OnboardDto) {
  // dto ya viene normalizado/validado. Permite completar perfil de Google.
  return prisma.usuario.update({ where: { id: userId }, data: dto });
}

async me(userId: string) {
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  return u && {
    id: u.id, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono,
    identidadCompleta: Boolean(u.nombre && u.cedula && u.telefono),
  };
}
```
Los controllers (Task 3, Step 4) ya pasan `userIdOf(req)`. El `onboard` queda bajo `IdentidadGuard`? NO — completar perfil ocurre cuando la identidad aún NO está completa. Cambiar el guard de `POST /usuarios/onboard` a uno que solo exija sesión válida (no identidad completa). Crear `SesionGuard` mínimo:
```typescript
// guards.ts
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.userId = await verifyUserToken(this.jwt, bearer(req));
    return true;
  }
}
```
Aplicar `SesionGuard` a `POST /usuarios/onboard` y `GET /usuarios/me` (reemplaza `IdentidadGuard` en esos dos). El resto sigue con `IdentidadGuard`.

- [ ] **Step 2: Build**

Run: `pnpm --filter @vnzl/api build`
Expected: compila.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/usuarios.ts apps/api/src/guards.ts
git commit -m "feat(api): onboard/me por JWT + SesionGuard para completar perfil"
```

---

### Task 7: Frontend — cliente API con Bearer + almacenamiento de token

**Files:**
- Modify: `apps/web/app/lib/api.ts`, `apps/web/app/lib/identity.ts`, `apps/web/app/constants/storage.ts`
- Create: `apps/web/app/lib/auth.ts` (helpers de token)

**Interfaces:**
- Produces:
  - `getToken(): string | null`, `setToken(t: string)`, `clearToken()` (localStorage key `"token"`).
  - `apiFetch` manda `Authorization: Bearer <token>` si hay token; conserva `x-fingerprint` para rate limit.
  - `me(): Promise<Usuario | null>` vía `GET /usuarios/me`.

- [ ] **Step 1: `auth.ts`**

```typescript
// apps/web/app/lib/auth.ts
import { STORAGE } from "../constants/storage";
export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(STORAGE.token));
export const setToken = (t: string) => localStorage.setItem(STORAGE.token, t);
export const clearToken = () => localStorage.removeItem(STORAGE.token);
```
Agregar `token: "token"` a `STORAGE` en `constants/storage.ts`. Conservar `fingerprint` (rate limit) y `anon` (navegación anónima). Quitar `identity` cuando ya no se use (Task 8).

- [ ] **Step 2: `apiFetch` con Bearer**

```typescript
// apps/web/app/lib/api.ts
import { getFingerprint } from "../fingerprint";
import { getToken } from "./auth";

export function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-fingerprint": getFingerprint(), // solo rate limit
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers),
    },
  });
}
```

- [ ] **Step 3: `identity.ts` rehidrata desde `/usuarios/me`**

`syncIdentity()` pasa a `me()`: si hay token, `GET /usuarios/me`; si 401, `clearToken()` y devolver null. `hasFullIdentity()` se deriva de `usuario.identidadCompleta`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/lib/api.ts apps/web/app/lib/identity.ts apps/web/app/lib/auth.ts apps/web/app/constants/storage.ts
git commit -m "feat(web): cliente API con Bearer + almacenamiento de token de sesión"
```

---

### Task 8: Frontend — vista de login (solo cédula + contraseña)

**Files:**
- Modify: `apps/web/app/page.tsx` (form de login: quitar `nombre` y `telefono`, dejar `cedula` + `password`)
- Create: `apps/web/app/lib/authApi.ts` (`login`, `register`, `googleLogin` que pegan a `/auth/*`)

**Interfaces:**
- Consumes: `setToken` (Task 7).
- Produces: `login(cedula, password): Promise<{token, usuario}>`.

- [ ] **Step 1: `authApi.ts`**

```typescript
// apps/web/app/lib/authApi.ts
import { apiFetch } from "./api";
import { setToken } from "./auth";

async function post(path: string, body: unknown) {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Error");
  return res.json();
}
export async function login(cedula: string, password: string) {
  const r = await post("/auth/login", { cedula, password }); setToken(r.token); return r;
}
export async function register(d: { nombre: string; cedula: string; telefono: string; password: string }) {
  const r = await post("/auth/register", d); setToken(r.token); return r;
}
export async function googleLogin(idToken: string) {
  const r = await post("/auth/google", { idToken }); setToken(r.token); return r;
}
```

- [ ] **Step 2: Form de login**

En `page.tsx` quitar inputs `nombre` y `telefono` (líneas ~290-312). Dejar `cedula` + nuevo input `password` (type=password). El submit llama `login(cedula, password)`; al éxito, recargar identidad (`me()`) y renderizar `ProfileView`. Agregar link "¿No tienes cuenta? Regístrate" → `/registro` (Task 9) y botón de Google (Task 10). Conservar la opción "navegar anónimo" (flag `anon`) — coherente con la decisión de navegación anónima.

- [ ] **Step 3: Verificación manual**

Run: `pnpm --filter @vnzl/web build`
Expected: compila. Smoke: login con la cuenta semilla (`V0000000` / `seed1234`) entra y `GET /usuarios/me` responde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/lib/authApi.ts
git commit -m "feat(web): login solo con cédula + contraseña"
```

---

### Task 9: Frontend — vista de registro

**Files:**
- Create: `apps/web/app/registro/page.tsx`

**Interfaces:**
- Consumes: `register` (Task 8).

- [ ] **Step 1: Formulario de registro**

Campos: `nombre`, `cedula`, `telefono`, `password` (+ confirmación). Validación cliente: password ≥ 8 y coincide con confirmación; cédula/teléfono con las mismas regex del backend (reutilizar helpers si ya existen en web, si no validación básica y dejar que el backend valide). Submit → `register({nombre, cedula, telefono, password})`; al éxito el usuario ya tiene token y queda autenticado → redirigir a la home autenticada. Manejar 409 "cédula ya existe" mostrando el mensaje. Botón de Google también disponible aquí (Task 10).

- [ ] **Step 2: Verificación**

Run: `pnpm --filter @vnzl/web build`
Expected: compila. Smoke: registro crea usuario, recibe token, entra autenticado.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/registro/page.tsx
git commit -m "feat(web): vista de registro (nombre, cédula, teléfono, contraseña)"
```

---

### Task 10: Frontend — botón Google + completar perfil

**Files:**
- Modify: `apps/web/package.json` (dep `@react-oauth/google`)
- Modify: `apps/web/app/layout.tsx` (envolver con `GoogleOAuthProvider`)
- Create: `apps/web/app/components/GoogleButton.tsx`
- Create: `apps/web/app/completar-perfil/page.tsx`

**Interfaces:**
- Consumes: `googleLogin` (Task 8), `onboard` (PATCH/POST `/usuarios/onboard`, Task 6).

- [ ] **Step 1: Instalar dep + provider**

Run: `pnpm --filter @vnzl/web add @react-oauth/google`
En `layout.tsx`, envolver children con `<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>`.

- [ ] **Step 2: Botón**

```tsx
// apps/web/app/components/GoogleButton.tsx
"use client";
import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { googleLogin } from "../lib/authApi";

export function GoogleButton() {
  const router = useRouter();
  return (
    <GoogleLogin
      onSuccess={async (cred) => {
        const r = await googleLogin(cred.credential!);
        router.push(r.needsProfile ? "/completar-perfil" : "/");
      }}
      onError={() => alert("Error con Google")}
    />
  );
}
```
Insertar `<GoogleButton />` en login (Task 8) y registro (Task 9).

- [ ] **Step 3: Completar perfil**

`completar-perfil/page.tsx`: formulario con `cedula` + `telefono` (el nombre vino de Google; permitir editarlo si está vacío). Submit → `apiFetch("/usuarios/onboard", {method:"POST", body: JSON.stringify({nombre?, cedula, telefono})})` (con Bearer ya presente). Al éxito redirigir a home autenticada. Esta ruta solo tiene sentido con token; si no hay token, redirigir a login.

- [ ] **Step 4: Verificación**

Run: `pnpm --filter @vnzl/web build`
Expected: compila. Smoke (requiere `GOOGLE_CLIENT_ID` válido): flujo Google nuevo → `needsProfile:true` → completar-perfil → identidadCompleta → acceso a acciones guarded.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/GoogleButton.tsx apps/web/app/completar-perfil/page.tsx apps/web/app/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): registro/login con Google + completar perfil (cédula, teléfono)"
```

---

### Task 11: Env + documentación

**Files:**
- Modify: `.env.example`, `README` o doc de setup relevante

- [ ] **Step 1: Variables**

Agregar a `.env.example`:
```
GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```
Documentar que `JWT_SECRET` ahora firma también la sesión de usuario (no solo admin/invitaciones).

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): GOOGLE_CLIENT_ID (API + web) para auth con Google"
```

---

## Notas de seguridad / verificación cruzada

- **Confusión de tokens (invitación vs sesión vs admin):** resuelto vía claim `typ` obligatorio en los 3 tipos y validado en cada verificador. Un token de invitación (`typ:"invite"`) NO pasa `verifyUserToken` (exige `typ:"user"`) ni `AdminGuard` (exige `typ:"admin"`), y `accept()` ahora exige `typ:"invite"`. Aceptar una invitación requiere estar logueado (la ruta usa `IdentidadGuard`), y asocia `req.userId` — no el fingerprint.
- **Cédula como login:** `cedula @unique` permite múltiples `NULL` (Postgres), así los usuarios de Google sin cédula coexisten hasta completar perfil; el login exige `passwordHash` presente.
- **Rate limit:** `/auth/login`, `/auth/register`, `/auth/google` bajo `RateLimitGuard` (anti fuerza bruta), keyed por `x-fingerprint`||IP.
- **Reset de datos:** los usuarios anónimos viejos (PK = device fingerprint) se descartan en el reset; no hay ruta de reclamo (decisión de dev).
