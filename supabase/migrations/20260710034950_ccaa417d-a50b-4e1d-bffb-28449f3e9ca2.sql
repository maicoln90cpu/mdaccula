ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS venue_lng numeric(9,6);

COMMENT ON COLUMN public.events.venue_lat IS 'Latitude do venue (para mapa estatico em e-mails).';
COMMENT ON COLUMN public.events.venue_lng IS 'Longitude do venue (para mapa estatico em e-mails).';