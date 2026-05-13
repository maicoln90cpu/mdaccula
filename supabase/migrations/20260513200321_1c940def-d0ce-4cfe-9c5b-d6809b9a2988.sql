-- Tabela para preservar URLs antigas após mesclagem de eventos (festivais)
CREATE TABLE IF NOT EXISTS public.event_slug_redirects (
  old_slug text PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_slug_redirects_event ON public.event_slug_redirects(event_id);

ALTER TABLE public.event_slug_redirects ENABLE ROW LEVEL SECURITY;

-- Público pode consultar (necessário para o redirect funcionar para visitantes anônimos)
CREATE POLICY "Anyone can view slug redirects"
  ON public.event_slug_redirects FOR SELECT
  USING (true);

-- Apenas admin pode gerenciar
CREATE POLICY "Admins can manage slug redirects"
  ON public.event_slug_redirects FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Service role can manage slug redirects"
  ON public.event_slug_redirects FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);