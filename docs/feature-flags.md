# Feature flags (Railway + Vercel)

> Estado: implementado · Última actualización: 2026-08-10 · Branch/PR: `feat/multipais-colombia` → dev

Cómo se prende y apaga el **portón de verificación de cédula** sin redeploy, y por qué está armado
así. Flag actual: `cedula-validacion-ve`.

## 1. Requerimientos iniciales

> "Meter todo el sistema de validación de cédula en un feature flag de Railway."
> Y después: "el frontend está en Vercel, entonces también me gustaría que usáramos los feature
> flags de Vercel."

## 2. Decisiones tomadas

### Railway es la fuente de verdad, Vercel refleja

Una sola decisión gobierna **dos lados**: si la API exige el nombre en el registro, y si el
formulario muestra el campo. Con un flag independiente en cada plataforma pueden desincronizarse, y
una de las dos direcciones rompe el registro venezolano justo cuando estás tirando del interruptor:

| Backend | Frontend | Resultado |
|---|---|---|
| OFF | ON (oculta el campo) | el form manda nombre vacío → 400 en loop → **registro VE roto** |
| ON | OFF (muestra el campo) | se teclea, el nombre oficial lo pisa → inofensivo |

Por eso hay **un solo flag, en Railway**. El frontend no define una copia: lee el valor efectivo por
`GET /config/flags`. Un flip, los dos lados.

Se descartó tener el flag en Vercel como fuente de verdad: el que decide el comportamiento real es
el backend, y la API no corre en Vercel.

### Flags, no variables de entorno

- Una env var necesita **redeploy** para cambiar. Un interruptor de emergencia que exige redeploy no
  sirve de mucho.
- `NEXT_PUBLIC_*` es peor todavía: se hornea en **build time**, así que haría falta un rebuild
  completo del frontend.
- Los feature flags de Railway se editan en caliente. El SDK sincroniza el registro al arrancar y lo
  refresca en background, así que las lecturas son **síncronas y en memoria** — sin latencia por
  request. Eso es lo que permite usar `validacionActiva()` dentro de un `@ValidateIf` de
  class-validator, que es un contexto síncrono.

### Vercel: solo el SDK, sin proveedor

Se instaló `flags` (el Flags SDK) con un `decide()` propio que lee de la API. Da el dashboard, el
Flags Explorer y la observabilidad de Vercel, y queda abierto para enchufar un proveedor del
Marketplace más adelante — sin que hoy exista una segunda copia del valor.

### El nombre y el portón

Con el portón **activo** (Venezuela), el nombre sale del registro civil y el formulario **no lo
pide**. Con el portón **apagado**, o en **Colombia** (que no tiene registro público que consultar),
el nombre pasa a ser obligatorio.

La misma función decide las dos cosas, así que no pueden contradecirse:

```ts
// apps/api/src/cedula.ts
export function validacionActiva(pais: Pais): boolean {
  return pais === "VE" && cedulaValidacionVe();
}
```

```ts
// apps/api/src/auth/dto.ts
@ValidateIf((o) => !validacionActiva(o.pais))
nombre!: string;
```

Si el portón está apagado y **no** llega un nombre, `validarParaRegistro` corta con 400 **en vez de
crear una cuenta sin nombre**: sin nombre, `identidadCompleta` es false y el usuario no puede crear
centros ni aceptar invitaciones — falla en silencio, sin error en logs.

## 3. Diseño técnico

```
RAILWAY — Settings → Feature Flags
  cedula-validacion-ve (bool, default true)
        │
        ├─► apps/api/src/feature-flags.ts
        │     initFeatureFlags()  ← main.ts, antes de aceptar tráfico
        │     cedulaValidacionVe() ← lectura síncrona en memoria
        │        │
        │        ├─► validacionActiva(pais)  → portón + si el DTO exige nombre
        │        └─► GET /config/flags       → { cedulaValidacionVe, sincronizado }
        │                                       cache: s-maxage=30, swr=60
        └─► apps/web/flags.ts
              flag({ key: 'cedula-validacion-ve', decide: fetch(API + '/config/flags') })
                 └─► app/registro/page.tsx (server) → prop → RegistroForm (client)
```

| Archivo | Qué hace |
|---|---|
| `apps/api/src/feature-flags.ts` | `initFeatureFlags()`, `cedulaValidacionVe()`, `flagsSincronizados()`. Nunca lanza. |
| `apps/api/src/config.controller.ts` | `GET /config/flags`, público, cacheado 30s. |
| `apps/web/flags.ts` | Declaración del flag con `decide()` que lee la API. |
| `apps/web/app/.well-known/vercel/flags/route.ts` | Endpoint de descubrimiento del Flags Explorer. |

**La página de registro está partida en dos** porque el Flags SDK evalúa solo en el servidor:
`app/registro/page.tsx` es server component y resuelve el flag; `app/registro/_components/RegistroForm.tsx`
es el cliente (react-hook-form) y lo recibe como prop. Efecto secundario: `/registro` pasó de
estático (`○`) a dinámico (`ƒ`) en el build. Es el costo de leer un flag en runtime.

**Defaults seguros.** Si el registro de Railway no sincronizó (sin token, red caída, arranque) o la
API no responde, todo cae a `true` — portón activo, comportamiento histórico, y nunca una cuenta sin
nombre.

## 4. Seguridad y edge cases

- `GET /config/flags` es público a propósito: no expone nada sensible, solo si un campo del
  formulario de registro es obligatorio.
- **Railway NO inyecta `RAILWAY_TOKEN` solo.** Sin él el SDK nunca sincroniza y la API sirve el
  default para siempre, en silencio. Por eso el endpoint devuelve `sincronizado` (ver §5).
- El `FLAGS_SECRET` de Vercel es **opcional**: solo habilita el Flags Explorer. El flag funciona sin
  él y el build no falla.
- **Propagación al frontend: hasta ~30-60s.** No es solo el TTL: el fetch usa
  `stale-while-revalidate`, así que la primera request después de expirar sirve el valor viejo y
  revalida en background; la siguiente ya ve el nuevo. La API flipea al instante. Si hiciera falta
  propagación inmediata, bajar `revalidate` a 0 en `apps/web/flags.ts` a costa de un fetch por
  render.

## 5. Operación

### Setup en Railway (obligatorio)

1. **Settings → Feature Flags** → crear `cedula-validacion-ve`, tipo `bool`, default `true`.
2. **Project Settings → Tokens** → crear un **project token** (infiere el proyecto solo).
3. En el servicio de la API: **Variables** → `RAILWAY_TOKEN = <token>`.

### Verificar que el flag se está leyendo de verdad

```bash
curl -s https://<api>/config/flags
# { "cedulaValidacionVe": true, "sincronizado": true }
#                                              ^^^^ tiene que ser true
```

Si `sincronizado` es `false`, el token no llegó y estás viendo el **default**, no tu flag.

### Tirar del interruptor (p. ej. api.cedula.com.ve caída)

1. Railway → Feature Flags → `cedula-validacion-ve` → `false`.
2. La API deja de consultar el registro civil al instante y pasa a exigir el nombre.
3. El formulario venezolano empieza a pedir el nombre en ≤60s.

No hace falta redeploy en ninguno de los dos lados.

### Flags Explorer de Vercel (opcional)

Solo para ver y overridear flags desde la barra de Vercel. Si no lo querés, **saltealo**: no afecta
el funcionamiento.

Camino automático: `vercel link` sobre `apps/web`, habilitar la Vercel Toolbar, abrir Flags Explorer
→ **Start setup** → **Create secret** (genera `FLAGS_SECRET` para Development, Preview y Production,
marcando los dos últimos como *Sensitive*), y después `vercel env pull`.

Camino manual, una vez por environment:

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
```

Cargarlo como `FLAGS_SECRET` en **Vercel → Settings → Environment Variables**, scoped al environment
correspondiente. Tiene que ser exactamente 32 bytes en base64url: es una clave de cifrado.
**Tiene que estar en los settings del proyecto en el dashboard** — definirlo solo en `.env` local no
alcanza, el Explorer lo lee de ahí.

### Agregar un flag nuevo

1. Crearlo en Railway.
2. Sumar el getter en `apps/api/src/feature-flags.ts` (con su default seguro).
3. Si el frontend lo necesita: exponerlo en `GET /config/flags` y declararlo en `apps/web/flags.ts`.

## 6. Verificación

En los tests el flag se mockea con `vi.hoisted` + `vi.mock("./feature-flags")` — no con env vars.
Ver `apps/api/src/cedula.spec.ts`, `cedula.test.ts` y `auth/dto.spec.ts` (cuándo se exige el
nombre).

Smoke manual hecho en local:

- La API arranca **sin** `RAILWAY_TOKEN` → `sincronizado: false`, sirve el default `true`.
- `GET /config/flags` responde con el `cache-control` esperado.
- Con el portón activo y sin credenciales de cédula, un registro VE devuelve **503** (esperado: hay
  portón pero no se puede verificar).
- Forzando el valor a `false`: el SSR de `/registro` pasa a mostrar "Nombre completo" y cambia el
  copy. La primera request tras el flip todavía sirve el valor viejo (`stale-while-revalidate`), la
  siguiente ya no.

## 7. Pendientes / deuda

- **`APP_ID_CEDULA` / `TOKEN_CEDULA` tienen que existir en Railway.** Con el portón activo y sin
  esas credenciales, `verificar()` devuelve null y **todo registro venezolano responde 503**. Es el
  comportamiento que ya tenía `main`, pero ahora conviene confirmarlo explícitamente antes de
  desplegar.
- El flag no usa reglas de targeting (Railway las soporta): es un on/off global. Alcanza para un
  kill switch.
- No hay alerta si `sincronizado` queda en `false` en producción. Hoy se detecta mirando el
  endpoint.
