
-- Tabela redirect_links
CREATE TABLE public.redirect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  description text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  clicks integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indice para busca por slug
CREATE INDEX idx_redirect_links_slug ON public.redirect_links (slug);

-- Trigger updated_at
CREATE TRIGGER update_redirect_links_updated_at
  BEFORE UPDATE ON public.redirect_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.redirect_links ENABLE ROW LEVEL SECURITY;

-- SELECT publico para enabled links (rota de redirect funcionar com anon)
CREATE POLICY "Public can view enabled redirect links"
  ON public.redirect_links
  FOR SELECT
  USING ((enabled = true) OR is_admin());

-- ALL para admins
CREATE POLICY "Admins can manage redirect links"
  ON public.redirect_links
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- RPC para incrementar cliques (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION public.increment_redirect_clicks(redirect_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.redirect_links
  SET clicks = clicks + 1
  WHERE slug = redirect_slug AND enabled = true;
END;
$$;
