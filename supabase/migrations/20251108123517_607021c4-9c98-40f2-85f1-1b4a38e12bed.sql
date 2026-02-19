-- Criar tabela de membros da equipe
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  instagram_url TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver membros ativos" 
  ON public.team_members 
  FOR SELECT 
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir membros" 
  ON public.team_members 
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar membros" 
  ON public.team_members 
  FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar membros" 
  ON public.team_members 
  FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir 3 membros exemplo
INSERT INTO public.team_members (name, position, bio, instagram_url, display_order, image_url) VALUES
  ('João Silva', 'Fundador & CEO', 'Pioneiro da cena eletrônica paulistana desde 2010. Responsável pela visão estratégica e parcerias internacionais.', 'https://instagram.com/joaosilva', 1, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'),
  ('Maria Santos', 'Co-Fundadora & Diretora Musical', 'DJ residente e curadora musical com mais de 15 anos de experiência. Especialista em techno e house music.', 'https://instagram.com/mariasantos', 2, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'),
  ('Pedro Costa', 'Diretor Criativo', 'Responsável pela identidade visual e produção de eventos. Vencedor de múltiplos prêmios de design.', 'https://instagram.com/pedrocosta', 3, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop');

-- Criar storage bucket para imagens de equipe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('team-images', 'team-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para team-images
CREATE POLICY "Imagens de equipe são públicas" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'team-images');

CREATE POLICY "Admins podem fazer upload de imagens de equipe" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar imagens de equipe" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar imagens de equipe" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Adicionar índices para performance
CREATE INDEX idx_team_members_active ON public.team_members(active);
CREATE INDEX idx_team_members_display_order ON public.team_members(display_order);

-- Adicionar search vector para blog_posts (SEO)
ALTER TABLE public.blog_posts 
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_blog_posts_search 
  ON public.blog_posts USING gin(search_vector);

-- Trigger para atualizar search_vector
CREATE OR REPLACE FUNCTION public.update_blog_posts_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_posts_search_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_posts_search_vector();

-- Atualizar search_vector de posts existentes
UPDATE public.blog_posts SET updated_at = updated_at;