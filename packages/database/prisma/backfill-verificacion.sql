-- Backfill de una sola vez, para el cambio "los centros sin verificar no se listan".
--
-- Hasta ahora `verificacion` era una etiqueta, no un portón: un centro operaba y
-- se listaba desde PENDIENTE. Al convertirla en portón, todos los centros que ya
-- existían quedarían invisibles de golpe. Este script los da por buenos: estaban
-- operando bajo la regla vieja. La regla nueva aplica a los que se creen después.
--
-- Correr UNA vez, durante el deploy que introduce el cambio, ANTES de que se
-- creen centros nuevos (si no, aprobaría sin revisión a los que sí deben pasar
-- por moderación). NO deja RECHAZADO tocado: si el equipo rechazó un centro,
-- sigue rechazado.
--
--   railway run psql $DATABASE_URL -f packages/database/prisma/backfill-verificacion.sql
--   # local:
--   docker exec -i vnzlcentrosdeinsumos-postgres-1 psql -U vnzl -d insumos \
--     -f - < packages/database/prisma/backfill-verificacion.sql

BEGIN;

UPDATE "Centro"
SET "verificacion" = 'VERIFICADO',
    "verificadoEn" = COALESCE("verificadoEn", now())
WHERE "verificacion" = 'PENDIENTE';

-- Control: no debería quedar ningún PENDIENTE.
SELECT "verificacion", count(*) FROM "Centro" GROUP BY "verificacion" ORDER BY 1;

COMMIT;
