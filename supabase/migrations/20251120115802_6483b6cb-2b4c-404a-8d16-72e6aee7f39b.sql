-- Criar tabela de templates de eventos
CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  venue TEXT NOT NULL,
  address TEXT,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  genres TEXT[] DEFAULT '{}',
  ticket_link TEXT,
  vip_link TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_event_templates_updated_at
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies (apenas admins podem gerenciar templates)
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver templates"
  ON public.event_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar templates"
  ON public.event_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar templates"
  ON public.event_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar templates"
  ON public.event_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserir templates iniciais de exemplo
INSERT INTO public.event_templates (name, venue, address, location_city, location_state, genres, ticket_link, vip_link, image_url)
VALUES
  ('The Year', 'The Year', 'Rua Barra Funda, 1020 - Barra Funda', 'São Paulo', 'SP', ARRAY['Techno', 'House', 'Tech House'], '', '', ''),
  ('Sonora Garden', 'Sonora Garden', 'Av. Bento Gonçalves, 123', 'São Paulo', 'SP', ARRAY['House', 'Deep House', 'Melodic'], '', '', '')
ON CONFLICT (name) DO NOTHING;