-- Fase 1: Criar Storage Bucket para imagens de eventos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true);

-- Policies para o bucket event-images
CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

CREATE POLICY "Admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event images"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela de configurações do site
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Criar tabela de posts do blog
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  content text NOT NULL,
  category text NOT NULL,
  author_id uuid REFERENCES auth.users(id),
  image_url text,
  published boolean DEFAULT false,
  published_at timestamp with time zone,
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Adicionar coluna slug à tabela events
ALTER TABLE public.events ADD COLUMN slug text UNIQUE;

-- Criar função para gerar slug
CREATE OR REPLACE FUNCTION public.generate_slug(text_input text)
RETURNS text AS $$
DECLARE
  slug_output text;
BEGIN
  -- Converte para minúsculas e remove acentos
  slug_output := lower(translate(
    text_input,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
  -- Substitui espaços e caracteres especiais por hífens
  slug_output := regexp_replace(slug_output, '[^a-z0-9]+', '-', 'g');
  -- Remove hífens no início e fim
  slug_output := trim(both '-' from slug_output);
  RETURN slug_output;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para gerar slug automaticamente em eventos
CREATE OR REPLACE FUNCTION public.set_event_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_slug_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION set_event_slug();

-- Trigger para gerar slug automaticamente em posts
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_slug_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_post_slug();

-- Trigger para updated_at em site_settings
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em blog_posts
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies para site_settings
CREATE POLICY "Anyone can view settings"
ON public.site_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can insert settings"
ON public.site_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
ON public.site_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete settings"
ON public.site_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para blog_posts
CREATE POLICY "Anyone can view published posts"
ON public.blog_posts FOR SELECT
USING (published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert posts"
ON public.blog_posts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update posts"
ON public.blog_posts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete posts"
ON public.blog_posts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir configuração inicial do GTM (vazio)
INSERT INTO public.site_settings (key, value)
VALUES ('google_tag_manager_id', '');