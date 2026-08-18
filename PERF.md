# Registro de performance

Bitácora de intentos de optimización: lo que se midió, lo que quedó y lo que se
descartó. **Leer antes de proponer un experimento** — una idea que ya se probó y
no rindió está anotada acá justamente para no volver a correrla.

Regla: una mejora que no supera la variación entre corridas se revierte, no se
guarda. Código que se guarda se mantiene para siempre.

## Cómo se mide

```bash
# Bundle: primer-load JS por ruta (gz), leído de los HTML prerenderizados
pnpm --filter @vnzl/web run build
# luego sumar los chunks referenciados por cada .next/server/app/**/*.html

# Fuente de iconos: pedir el CSS con User-Agent de Chrome y bajar el woff2
curl -A "<UA de Chrome>" "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:<ejes>[&icon_names=...]&display=swap"
```

## 2026-08-12 — Primera pasada

Baseline: piso compartido de **250.7 KB gz** en las 27 rutas, primer-load de
285–305 KB gz por ruta.

| Idea | Baseline → Resultado | Veredicto | Por qué |
|---|---|---|---|
| Subset de Material Symbols vía `icon_names=` (81 iconos) | woff2 **3,964,532 B → 84,172 B** | **queda** | 47× menos. Era un `<link>` que bloquea render en todas las rutas. |
| `next/font/google` para self-hostear la fuente de iconos | — | **descartado** | `next/font` no puede generar `icon_names`: su `get-google-fonts-url.js` arma la URL solo con family + ejes + display. Verificado en la fuente de Next 16.2.9. No reintentar sin revisar si Next lo agregó. |
| `GoogleOAuthProvider` fuera del `Providers` raíz | piso 250.7 → **251.3 KB gz** | **queda, pero no por el bundle** | En bytes de JS es ruido (+0.6 KB). Lo que sí cambia: `GoogleOAuthProvider` inyecta `<script src="accounts.google.com/gsi/client">` al montarse, así que **24 de 27 rutas dejaron de pedir 98,317 B de un tercero** más su DNS+TLS (~455 ms de TTFB medido). El paquete quedó aislado en un chunk de 1.6 KB gz. |
| Colapsar los loops por item en `centros.create` / `historial.recibir` / `envios.crear` | 3N+2 → 4 queries; 3N → ~4; 2N+1 → ~3 | **queda** | Conteo determinístico, con tests que lo afirman. |
| `recalcularNiveles`: un `update` por insumo → `updateMany` por nivel destino | N → ≤3 queries | **queda** | `nivel` tiene 3 valores posibles. |

### Pendiente, medido pero no atacado

- El piso compartido sigue en **251.3 KB gz**, arriba del presupuesto de 200 KB.
  El grueso es un chunk de 137.7 KB gz (framework Next + React + Sentry cliente).
  Antes de tocarlo hay que medir cuánto de eso es Sentry: es el único candidato
  con recorte posible sin cambiar de framework.
- Error de tipos preexistente en
  `app/(app)/mis-centros/[centroId]/_components/InventarioResumen.test.tsx`: el
  mock de `InsumoDetalle` no tiene `umbralUrgente` / `umbralSuficiente`. No lo
  introdujo esta pasada.
