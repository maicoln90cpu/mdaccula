ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.latitude IS 'Latitude geocodificada da venue (Google Maps)';
COMMENT ON COLUMN public.events.longitude IS 'Longitude geocodificada da venue (Google Maps)';
COMMENT ON COLUMN public.events.geocoded_at IS 'Momento da última geocodificação bem-sucedida';