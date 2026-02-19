-- 1. Adicionar coluna end_time (horário de término - opcional)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS end_time time without time zone;

COMMENT ON COLUMN events.end_time IS 'Horário de término do evento (opcional)';

-- 2. Transformar genre de text para ARRAY (múltiplos gêneros)
-- Primeiro, criar nova coluna temporária
ALTER TABLE events 
ADD COLUMN genres_array text[];

-- Migrar dados existentes (converter text atual para array)
UPDATE events 
SET genres_array = ARRAY[genre] 
WHERE genre IS NOT NULL;

-- Remover coluna antiga e renomear
ALTER TABLE events DROP COLUMN genre;
ALTER TABLE events RENAME COLUMN genres_array TO genres;

-- Tornar genres NOT NULL com default vazio
ALTER TABLE events 
ALTER COLUMN genres SET DEFAULT '{}',
ALTER COLUMN genres SET NOT NULL;

COMMENT ON COLUMN events.genres IS 'Lista de gêneros musicais do evento';