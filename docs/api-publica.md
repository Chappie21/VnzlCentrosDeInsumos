# Flujo: Documentación de la API pública (OpenAPI / Swagger)

> Estado: implementado · Última actualización: 2026-07-01 · Branch/PR: #85

## 1. Requerimientos iniciales
Documentar la API con OpenAPI para que terceros que quieran usar los **endpoints
públicos** puedan hacerlo. Se evaluó tener dos documentaciones (API completa +
solo EPs públicos); se decidió **solo la pública**.

## 2. Decisiones tomadas
- **Una sola doc, solo endpoints públicos** → por seguridad (modelo de amenaza
  SEBIN): una doc completa listaría los EPs de admin/jefe/moderación y campos PII
  (cédula, teléfono, GPS) = mapa de reconocimiento para un atacante. La doc
  completa se difiere; si se agrega, debe ir gateada (solo dev o detrás de auth).
- **`@nestjs/swagger`** (nativo del framework, sin deps extra) → descartado armar
  algo a mano o docs estáticas que se desincronizan del código.
- **Filtrado por tag** en vez de por módulo: los EPs públicos e internos conviven
  en el mismo controller (`CentrosController`), así que se marcan con
  `@ApiTags("publico")` y se filtra el documento por ese tag.

## 3. Diseño técnico
- **Backend** (`apps/api/src`):
  - `main.ts`: `DocumentBuilder` + `SwaggerModule.createDocument`, luego se
    **filtra** `document.paths` a los ops con tag `publico` y se **poda**
    `components.schemas` a los referenciados (transitivamente) por esas rutas.
    `SwaggerModule.setup("docs", ...)`.
  - EPs marcados `@ApiTags("publico")` + `@ApiOperation` + `@ApiOkResponse`
    (con ejemplos): `GET /centros`, `GET /centros/mapa`,
    `GET /centros/:centroId/publico`, `GET /envios/:id`.
- **URLs expuestas**:
  - **Swagger UI:** `GET /docs`
  - **Spec OpenAPI JSON:** `GET /docs-json` (para generar clientes)

## 4. Seguridad y edge cases
- El plugin de `@nestjs/swagger` **se auto-activa** bajo `nest build`/`nest start`
  (el path real de dev y prod) e introspecta **todos** los DTOs a
  `components.schemas`. Filtrar solo `paths` dejaba 19 DTOs internos (`LoginDto`,
  `EnvioDto`, `CreateCentroDto`…) expuestos en `/docs-json`. Se corrige podando
  `components.schemas` a lo referenciado por las rutas públicas.
- **Gotcha de verificación:** con `tsx src/main.ts` el plugin **no** corre → el
  spec sale limpio y engaña. Verificar swagger **siempre** con `nest start`
  (o `dist` tras `nest build`).
- La doc no abre recon nuevo: solo lista superficie ya accesible sin auth. El
  único dato sensible (`latitud`/`longitud` + `direccion` en el detalle público)
  ya lo devuelve el EP; ofuscarlo es decisión aparte del EP, no de la doc.

## 5. Verificación
- `tsc --noEmit` ✅ · 143 tests ✅
- Smoke bajo `nest start`: `/docs-json` lista exactamente los 4 EPs públicos,
  `components.schemas` vacío, cero rutas/DTOs internos.

## 6. Pendientes / deuda
- Doc de la API **completa** (interna): no se hizo (YAGNI + riesgo de recon). Si
  se agrega, gatearla (solo dev o detrás de `AdminGuard`).
- Ofuscar coords / bajar dirección exacta a login en el EP público: decisión de
  producto pendiente de la auditoría de privacidad, ajena a este flujo.
