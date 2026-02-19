-- Criar tabela para fontes de notícias configuráveis
CREATE TABLE public.news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela para rastrear posts gerados por IA
CREATE TABLE public.ai_generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  source_urls TEXT[],
  prompt_used TEXT,
  model_used TEXT DEFAULT 'google/gemini-2.5-flash',
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_posts ENABLE ROW LEVEL SECURITY;

-- Policies para news_sources (apenas admins)
CREATE POLICY "Admins can manage news sources" 
ON public.news_sources 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para ai_generated_posts (apenas admins)
CREATE POLICY "Admins can view AI posts" 
ON public.ai_generated_posts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert AI posts" 
ON public.ai_generated_posts 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Inserir sites de exemplo
INSERT INTO public.news_sources (name, url, description, enabled) VALUES
  ('Resident Advisor', 'https://ra.co/events/br/saopaulo', 'Eventos de música eletrônica em São Paulo', true),
  ('Time Out São Paulo', 'https://www.timeout.com/sao-paulo/music', 'Agenda cultural e musical de SP', true),
  ('Groove Magazine', 'https://groove.de/', 'Revista alemã especializada em techno e house', true),
  ('Techno.org', 'https://www.techno.org/', 'Portal internacional de música eletrônica', false),
  ('DJ Mag Brasil', 'https://djmagbrasil.com.br/', 'Revista brasileira de música eletrônica', true);