-- Criar índice composto para otimizar filtros por data e localização
CREATE INDEX IF NOT EXISTS idx_events_date_location 
ON public.events (date, location_state, location_city);

-- Comentário explicativo
COMMENT ON INDEX idx_events_date_location IS 'Índice composto para otimizar queries de filtros por data e localização na página de eventos';