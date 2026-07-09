
CREATE TABLE public.egoi_resources_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true,
  lists JSONB NOT NULL DEFAULT '[]'::jsonb,
  senders JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT egoi_resources_cache_singleton_unique UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.egoi_resources_cache TO authenticated;
GRANT ALL ON public.egoi_resources_cache TO service_role;

ALTER TABLE public.egoi_resources_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read egoi cache"
  ON public.egoi_resources_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write egoi cache"
  ON public.egoi_resources_cache FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_egoi_resources_cache_updated_at
  BEFORE UPDATE ON public.egoi_resources_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
