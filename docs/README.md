# Documentación de flujos

Un archivo `.md` por **flujo** (feature de punta a punta). Copiá el template de abajo a
`docs/<nombre-del-flujo>.md` y completalo **antes** de dar el flujo por terminado.
Ver las reglas en [`AGENTS.md`](../AGENTS.md).

## Índice de flujos

<!-- agregá una línea por flujo documentado -->
- [Onboarding e identidad](onboarding.md) — datos del usuario + 3 caminos, identidad sin login.
- [Directorio de centros](directorio-centros.md) — listado público con filtros y geolocalización.
- [Donar (donación por QR)](donar.md) — carrito de insumos → QR de entrega stateless.
- [Crear centro + invitar](crear-centro.md) — registrar un centro de acopio e invitar ayudantes.
- [Gestión de voluntarios](voluntarios.md) — el JEFE lista a sus miembros y los remueve.
- [Recepción por escaneo](escaneo.md) — voluntario escanea el QR y registra insumos en su centro.
- [Envíos (descargo)](envios.md) — despacho de un centro a otro destino + guía con QR.

---

## Template

```markdown
# Flujo: <nombre>

> Estado: borrador | implementado · Última actualización: AAAA-MM-DD · Branch/PR: #N

## 1. Requerimientos iniciales
Los requerimientos tal como se pidieron (pegá el pedido original, sin reinterpretar).

## 2. Decisiones tomadas
- Decisión → por qué. Alternativas descartadas y motivo.

## 3. Diseño técnico
- **Frontend**: rutas, componentes, estado, validaciones.
- **Backend**: endpoints (método + ruta), DTOs, guards, reglas de negocio.
- **Datos**: modelos Prisma involucrados, transacciones, índices.

## 4. Seguridad y edge cases
- Qué se validó, qué se asumió, qué puede fallar y cómo se maneja.

## 5. Verificación
- Tests (unit) y smoke/manual. Cómo reproducir que funciona.

## 6. Pendientes / deuda
- Lo que quedó deferido (marcar con `ponytail:` en el código si aplica).
```
