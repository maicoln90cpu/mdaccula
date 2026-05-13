ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date date NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS schedule jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_events_end_date ON public.events(end_date) WHERE end_date IS NOT NULL;

COMMENT ON COLUMN public.events.end_date IS 'Data final do evento (festivais multi-dias). NULL = evento de 1 dia, usa apenas date.';
COMMENT ON COLUMN public.events.schedule IS 'Agenda por dia do festival: [{date, time, end_time, lineup[]}]. NULL = usa time/end_time/lineup raiz.';

ALTER TABLE public.events ADD CONSTRAINT events_end_date_after_date CHECK (end_date IS NULL OR end_date >= date);