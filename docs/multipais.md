# Flujo: Multi-país (Venezuela + Colombia)

> Estado: implementado · Última actualización: 2026-08-10 · Branch/PR: `feat/multipais-colombia` → dev

## 1. Requerimientos iniciales

Pedido original, tras el terremoto en Colombia:

1. Cambiar el nombre de la página por algo más global.
2. Meter todo el sistema de validación de cédula en un feature flag de Railway, para mantenerlo
   deshabilitado de momento.
3. Agregar un campo `país` al usuario al registrarse. De momento solo Venezuela y Colombia, con el
   país detectado por ubicación preseleccionado por defecto.
4. Los centros de acopio también tendrán país, puesto por defecto según el país del usuario que
   los crea.
5. Al mostrar centros de acopio, debe seguir funcionando por GPS y además por país.

**Corrección posterior del requisito 2** (misma iteración): en vez de dejar la validación apagada,
**queda activa para Venezuela** para que el nombre se siga tomando del registro civil. Colombia sí
pide el nombre en la UI. Se investigaron integraciones de verificación de cédula colombiana: no
existe API pública gratuita (ver §2).

## 2. Decisiones tomadas

- **Nombre: "Red de Acopio LATAM"** (antes "Red Acopio Venezuela"). El dominio
  `redacopiovnzla.com` **se mantiene** por ahora: cambiarlo implica DNS, OG, sitemap y redirects, y
  no aporta nada durante la emergencia. Solo cambia el nombre visible.
- **Dataset completo de Colombia**, no texto libre. Fuente:
  [`marcovega/colombia-json`](https://github.com/marcovega/colombia-json). El dataset original
  traía dos defectos que se corrigieron al generar `data.co.ts`:
  - **Bogotá venía como municipio de Cundinamarca**, al que no pertenece administrativamente. Se
    separó como departamento propio `"Bogotá D.C."` (DIVIPOLA 11). Quedan 33 departamentos.
  - **`Chibolo` duplicado** en Magdalena.
  Total final: 33 departamentos / 1103 municipios.
- **Paquete renombrado** `@vnzl/venezuela` → `@vnzl/paises`. La API pasa a ser por país:
  `estadosDe(pais)`, `ciudadesDe(pais, estado)`, `parseDocumento(pais, raw)`. `municipiosDe` y
  `parseCedula` se renombraron a propósito: el rename fuerza a revisar cada call site, que es lo que
  se quiere cuando cambia la semántica.
- **Los regex de documento y teléfono viven solo en `@vnzl/paises`.** Antes estaban duplicados a
  mano en tres lugares (paquete, `apps/api/usuarios.ts`, `apps/web/lib/validate.ts`) con un
  comentario "mismas reglas que el backend". Ahora API y web importan la misma definición: no hay
  sync que mantener, y es **menos** código neto.
- **`pais` es un enum de Prisma NOT NULL con `@default(VE)`.** El default *es* el backfill: Postgres
  rellena las filas existentes al agregar la columna. Cero script de migración, cero rama
  `pais ?? "VE"`, cero manejo de "usuarios legacy sin país" — el caso se resuelve por construcción.
- **Detección de país por zona horaria del navegador**, no por IP ni GPS. `America/Bogota` → CO,
  `America/Caracas` → VE, cualquier otra cosa → VE. Cero red, cero permisos, cero dependencias.
  Descartado: header de IP (ata a Vercel + middleware) y geocodificación inversa (permiso + llamada
  externa que puede fallar).
- **El país del centro lo hereda del creador.** El DTO lo recibe para validar estado/ciudad contra
  el dataset correcto, pero `create()` lo contrasta contra el país del usuario y rechaza si no
  coincide.
- **Sin filtro de país, `GET /centros` no filtra** (devuelve ambos países). Es un endpoint público
  y quien llega por un link compartido no tiene país; poner VE por default escondería Colombia. El
  frontend siempre manda el suyo.
- **Verificación de cédula colombiana: no se integra.** No existe API pública gratuita. El portal
  oficial [`certvigenciacedula.registraduria.gov.co`](https://certvigenciacedula.registraduria.gov.co/)
  es un formulario con captcha (responde 403 a un fetch programático). Solo hay vendors comerciales
  de KYC: [Didit](https://docs.didit.me/api-reference/database-validation/colombia/cedula) (500
  verificaciones gratis/mes y después cobra), [Verifik](https://docs.verifik.co/verifik-es/identity/colombia-cedula-registraduria/)
  y [Apitude](https://apitude.co/es/docs/services/registraduria-co/). El punto de extensión queda
  listo: `validacionActiva()` y `parseDocumento()` ya son por país, así que sumar un proveedor
  colombiano es implementar un método.
- **El nombre se teclea solo cuando no hay registro civil que lo provea.** Ver
  [`feature-flags.md`](feature-flags.md) §"El nombre y el portón".

## 3. Diseño técnico

### Datos (`packages/database/prisma/schema.prisma`)

```prisma
enum Pais { VE  CO }

model Usuario { pais Pais @default(VE)  /* ... */ }
model Centro  { pais Pais @default(VE)  /* ... */ }
```

Índices en `Centro`:

| Índice | Motivo |
|---|---|
| `@@index([pais, estado, ciudad])` | Reemplaza `[estado, ciudad]`, que era **código muerto**: `buildWhere()` nunca filtró por estado. |
| `@@index([pais, latitud])` | Prefiltro del bounding box de `query()`, que no tenía ningún índice. Igualdad + rango es lo que aprovecha un btree; `longitud` como tercer campo no aportaría. |
| `@@index([recibiendoAhora])` | Sin cambios. |

Se aplica con `prisma db push` (el repo no usa migraciones). En producción lo corre solo el
`preDeployCommand` de `railway.json`.

### Paquete compartido (`packages/paises`)

```ts
export const PAISES = ["VE", "CO"] as const;
export type Pais = (typeof PAISES)[number];

export const PAIS_META: Record<Pais, {
  label: string; bandera: string;
  labelEstado: string;   // "Estado" | "Departamento"
  labelCiudad: string;   // "Ciudad"  | "Municipio"
  mapa: { lat: number; lng: number; zoom: number };
  ejemploDocumento: string; ejemploTelefono: string;
}>;

estadosDe(pais)                     ciudadesDe(pais, estado)
esEstadoValido(pais, estado)        esCiudadValida(pais, estado, ciudad)
parseDocumento(pais, raw)           normalizarDocumento(pais, raw)
esTelefonoValido(pais, tel)         normalizarTelefono(raw)
```

Formatos por país (`src/documento.ts`):

| | Documento | Móvil |
|---|---|---|
| VE | `^([VE])-?(\d{6,8})$`, rango 100.000–40.000.000 | `^(?:\+?58\|0)?4(?:12\|14\|16\|24\|26)\d{7}$` |
| CO | `^(\d{6,10})$` — sin letra de nacionalidad. Solo longitud: la cédula de ciudadanía no tiene dígito verificador público (el NIT sí). | `^(?:\+?57)?3\d{9}$` — móvil siempre empieza en 3. |

`normalizarDocumento` solo antepone `"V"` a los dígitos sueltos **en Venezuela**. Hacerlo en
Colombia guardaría `V1020304050` y el usuario no volvería a entrar a su cuenta.

### Backend (`apps/api`)

- **Validadores cross-field** (`src/validators.ts`): `IsDocumentoDePais`, `IsTelefonoDePais`,
  `IsEstadoDePais`, `IsCiudadDeEstado`. Leen el hermano `pais` con `args.object` y **fallan
  cerrado** si no es válido — el orden de validación entre propiedades no está garantizado.
- **`RegisterDto`**: `pais` (`@IsIn`), `nombre` (condicional, ver feature-flags), `cedula`,
  `telefono`. El `@Transform` de normalización lee `obj.pais`.
- **Login sin país** (`auth.service.porDocumento`): el login no pide país para no meter fricción en
  el flujo más caliente. Busca el documento tal cual y, si no aparece y son puros dígitos, reintenta
  con el prefijo `"V"` — que es como quedaron guardados todos los usuarios previos a Colombia. Dos
  `findUnique` en el peor caso.
- **Filtro de país**: `ListCentrosQueryDto.pais` → `buildWhere()`. `query()` **no cambia**: el
  `where` ya lo trae, así que el filtro aplica igual en la rama con GPS (bounding box + Haversine) y
  en la sin GPS. El GPS sigue funcionando exactamente igual.
- **Cache keys**: `pais` entra en la key de `list()` **y** en la de `mapaCoords()`. Sin eso, un país
  envenena la caché del otro durante el TTL (30s / 300s). Hay tests que lo cubren.
- `GET /centros/mapa?pais=`, y `detalle()` / `detallePublico()` devuelven `pais`.

### Frontend (`apps/web`)

- `app/lib/pais.ts`: `paisPorTimezone()`, `paisActual()` (el de la cuenta gana), `pideNombre()`.
- **`Intl.DateTimeFormat()` va SIEMPRE dentro de `useEffect`.** En SSR devuelve la zona del
  *servidor* (UTC en Vercel), así que llamarlo en el render de un client component produce un
  hydration mismatch. Patrón: `useState(PAIS_POR_DEFECTO)` como valor SSR estable +
  `useEffect(() => setPais(paisActual()), [])`.
- `SelectField` acepta `string` o `{value, label}` — necesario para `"CO" → "Colombia"`. Cambio
  aditivo, retrocompatible con todos los usos existentes.
- `CentroForm`: el país **no es un select** (se hereda), se muestra como badge. Las etiquetas de los
  dos selects salen de `PAIS_META` ("Estado"/"Ciudad" vs "Departamento"/"Municipio").
- Listado: segmented control `PaisSwitch` **fuera** del sistema de chips — `FILTER_CHIPS` es
  `Record<FilterId, boolean>` y un valor excluyente de dos estados ensuciaría el tipo.
- **Bundle**: se quitó `export * from "./venezuela"` del barrel `app/constants/index.ts`, que lo
  importa media app. `CentroForm` importa directo de `@vnzl/paises`. Verificado que el dataset
  **no** entra en `rootMainFiles` (lo que carga toda ruta), solo en las 6 rutas que lo usan.

## 4. Seguridad y edge cases

- **Aislamiento entre países**: un centro colombiano no puede guardarse con geografía venezolana ni
  al revés. Se valida en el boundary (DTO, contra la whitelist) y en `create()` (contra el país del
  usuario).
- **Colisión de documentos VE/CO**: una cédula colombiana de 8 dígitos podría coincidir en número
  con una venezolana. No importa: se guardan distinto (`V12345678` vs `12345678`), son filas
  distintas, y el login prioriza la coincidencia exacta.
- **Usuarios y centros previos a Colombia**: quedan en `VE` por el default de la columna. No hay
  código de compatibilidad porque no hace falta.
- **Encoding del dataset**: una tilde mal en `Medellín` o `Chocó` sería un rechazo permanente de esa
  ciudad por la whitelist. Se verificó al generar.
- **Orden de despliegue**: `main.ts` usa `ValidationPipe({ whitelist: true })` **sin**
  `forbidNonWhitelisted`, así que una API vieja descarta `pais` **en silencio** (no da 400). Hay que
  desplegar **API antes que web**; al revés, los centros creados por colombianos quedarían marcados
  `VE` sin ningún error visible.

## 5. Verificación

```bash
pnpm install && pnpm db:push
pnpm --filter @vnzl/paises test   # 26
pnpm --filter @vnzl/api test      # 169
pnpm --filter @vnzl/web test      # 148
pnpm build
```

Checks nuevos que valen por sí solos:

- `packages/paises/src/index.test.ts` — aislamiento entre países (`esEstadoValido("CO","Miranda")`
  es false), Bogotá ya no cuelga de Cundinamarca.
- `packages/paises/src/documento.test.ts` — `normalizarDocumento("CO", …)` **no** prefija `"V"`.
- `apps/api/src/centros.test.ts` — dos `list()` con país distinto producen cache keys distintas.
  *Este es el test que atrapa el envenenamiento de caché.*
- `apps/web/app/lib/pais.test.ts` — `Intl` stubeado, incluido el caso en que lanza.

Smoke manual (con la API y Postgres locales), verificado con curl:

1. Registro colombiano → `identidadCompleta: true`, `pais: "CO"`.
2. Login con el documento numérico sin prefijo → entra.
3. Crear centro en Antioquia/Medellín → aparece en `?pais=CO` y **no** en `?pais=VE`.
4. `{pais:"CO", estado:"Miranda"}` → rechazado. `{pais:"VE"}` con un usuario CO → rechazado.
5. `?pais=VE` + `?pais=CO` suman el total sin filtro.
6. `?pais=CO&lat=6.25&lng=-75.59&radiusKm=50` → ordena por distancia dentro del país.
7. `GET /centros/mapa?pais=VE` no trae puntos colombianos.

## 6. Pendientes / deuda

- **Sin verificación de identidad para Colombia.** Un colombiano se registra con cualquier número
  de 6-10 dígitos. Es el mismo nivel de confianza que tenía Venezuela antes de CEN-23. Si aparece
  presupuesto, ver los vendors listados en §2.
- El dataset de Colombia es estático (`ponytail:`), igual que el de Venezuela. Migrar a DB solo si
  hay que gestionarlo en runtime.
- `radiusKm` sigue fijo en 5 km en el frontend (`useCentros.ts`), sin relación con el país.
- El dominio sigue siendo `redacopiovnzla.com`.
- `apps/web/.../InventarioResumen.test.tsx` falla en `tsc --noEmit` por `umbralUrgente` /
  `umbralSuficiente` faltantes. **Es previo a este trabajo** (falla igual en `dev`), no se tocó.
