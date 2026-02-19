-- Criar índice para melhorar performance de joins entre custom_links e events
CREATE INDEX IF NOT EXISTS idx_custom_links_event_id 
ON custom_links(event_id) 
WHERE event_id IS NOT NULL;