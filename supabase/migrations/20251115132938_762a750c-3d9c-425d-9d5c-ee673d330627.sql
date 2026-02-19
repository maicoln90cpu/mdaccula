-- Criar tabela de grupos de links
CREATE TABLE IF NOT EXISTS public.link_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de links customizados
CREATE TABLE IF NOT EXISTS public.custom_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  group_id UUID REFERENCES public.link_groups(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  icon TEXT DEFAULT 'ExternalLink',
  color_gradient TEXT DEFAULT 'from-blue-500 to-cyan-500',
  clicks INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.link_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_links ENABLE ROW LEVEL SECURITY;

-- Políticas para link_groups
CREATE POLICY "Anyone can view enabled link groups"
  ON public.link_groups FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage link groups"
  ON public.link_groups FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para custom_links
CREATE POLICY "Anyone can view enabled links"
  ON public.custom_links FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage custom links"
  ON public.custom_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at em link_groups
CREATE TRIGGER update_link_groups_updated_at
  BEFORE UPDATE ON public.link_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em custom_links
CREATE TRIGGER update_custom_links_updated_at
  BEFORE UPDATE ON public.custom_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_link_groups_display_order ON public.link_groups(display_order);
CREATE INDEX IF NOT EXISTS idx_custom_links_group_id ON public.custom_links(group_id);
CREATE INDEX IF NOT EXISTS idx_custom_links_display_order ON public.custom_links(display_order);

-- Seed inicial: migrar links existentes
INSERT INTO public.link_groups (name, display_order, enabled) VALUES
  ('Redes Sociais', 0, true),
  ('Navegação', 1, true)
ON CONFLICT DO NOTHING;