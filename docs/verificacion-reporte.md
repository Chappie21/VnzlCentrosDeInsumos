# Confianza: verificación + reporte de centros (CEN-21 / CEN-22)

Distinguir centros legítimos de falsos **sin bloquear su uso**. Dos mecanismos
complementarios: verificación del equipo (etiqueta) y reporte de la comunidad.

## 1. Requerimientos
- Que gente de mala fe no pueda hacer pasar centros falsos por reales.
- No esperar aprobación para operar (en emergencia, bloquear mata a los legítimos).
- Que los usuarios puedan **reportar** un centro inválido.

## 2. Decisiones
- **Verificación = etiqueta, no portón.** Todo centro nace `PENDIENTE` y opera igual.
- **Verifica solo el equipo**, con **token compartido** (`ADMIN_TOKEN` + header `x-admin-token`,
  `AdminGuard`). ponytail: secreto compartido; upgrade a roles reales después.
- **Evidencia para el verificador:** foto del local/cartel + geo de registro (distancia a
  la dirección declarada, haversine) + responsable (cédula/teléfono). `parseCedula` valida
  formato offline (se descartó scraping del CNE: caído, valida cédula-existe ≠ centro-legítimo, PII).
- **Reporte anónimo por dispositivo** (fingerprint, sin login), 1 por dispositivo por centro.
  Motivos: *Ya no está · Info incorrecta · Engañoso*. **No auto-oculta ni auto-rechaza**:
  acumula y, al pasar el umbral (3), marca "reportado" y prioriza en moderación. Decide el equipo.
- Los reportes son **solo para el equipo** (no se muestran en el directorio público; evita brigading).

## 3. Diseño técnico
- **Datos:** `EstadoVerificacion {PENDIENTE,VERIFICADO,RECHAZADO}` + `Centro.verificacion/verificadoEn/fotoUrl/geoLat/geoLng`.
  `MotivoReporte {NO_EXISTE,INFO_INCORRECTA,ENGANOSO}` + `Reporte {centroId, fingerprint, motivo, comentario?}`
  con `@@unique([centroId, fingerprint])` (fingerprint sin FK = anónimo).
- **API:**
  - `PATCH /centros/:id/verificacion {estado}` (AdminGuard).
  - `GET /centros/moderacion?estado=` (AdminGuard): PENDIENTE + cualquier centro reportado;
    devuelve foto, geo+distancia, responsable, conteo/motivos de reportes, flag `reportado`;
    ordena reportados primero.
  - `POST /centros/:id/foto {foto}` (JEFE, data URL base64; `/uploads` estático).
  - `POST /centros/:id/reportes {motivo, comentario?}` (anónimo, rate-limited, upsert por dispositivo).
  - Directorio expone `verificado` + filtro `?verificado`; detalle expone `verificacion/fotoUrl`.
- **Web:** badge ✓ + chip "Verificados" en el directorio; botón "Reportar" + hoja de 3 motivos
  en la card; captura de geo al crear; badge + subida de foto en el dashboard; panel `/moderacion`
  (token → lista con evidencia + reportes → Verificar/Rechazar).
- **Paquete:** `@vnzl/venezuela` suma `parseCedula` y `distanciaMetros` (con tests).

## 4. Seguridad y edge cases
- Moderación protegida por token compartido (sin `ADMIN_TOKEN` el guard niega todo).
- Foto: solo JEFE; valida tipo (png/jpg/webp) y tamaño (≤3 MB); se comprime en el cliente.
- Reporte no dispara acciones automáticas → el spam solo agrega ruido a la cola (dedupe + rate-limit lo acotan).
- Geo best-effort: si la deniegan, el centro se crea igual (distancia queda null).

## 5. Verificación
- Unit: `cedula.test.ts`, `geo.test.ts` (venezuela); `centros.test.ts` (verificar, moderación con
  distancia/reportes/orden, setFoto, reportar); `ReportarSheet.test.tsx`, fixtures de card/detalle (web).
- Smoke: crear centro (captura geo) → subir foto → `/moderacion` con token → verificar; reportar desde la card.

## 6. Pendientes / deuda
- `ADMIN_TOKEN` es un secreto compartido (no roles). Upgrade a roles/login real si hay más moderadores.
- Fotos en disco local (`apps/api/uploads/`) — mover a object storage para prod multi-instancia.
- Upgrades del mockup no incluidos: frescura/expiración ("caduca en 48h"), fuente, historial de cambios.
