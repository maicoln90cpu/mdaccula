# 📊 Script Completo de Recriação do Banco de Dados

## ⚠️ AVISO IMPORTANTE

Este script irá recriar TODAS as tabelas do zero no seu Supabase externo.
**CERTIFIQUE-SE DE TER BACKUP ANTES DE EXECUTAR!**

---

## 🗑️ PASSO 0: Deletar Tabelas Existentes (OPCIONAL - SE NECESSÁRIO)

```sql
-- ⚠️ ATENÇÃO: Isto irá DELETAR TODAS as tabelas e dados!
-- Execute APENAS se quiser começar do zero

DROP TABLE IF EXISTS public.sync_logs CASCADE;
DROP TABLE IF EXISTS public.newsletter_popup_analytics CASCADE;
DROP TABLE IF EXISTS public.newsletter_popup_variants CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.blog_post_likes CASCADE;
DROP TABLE IF EXISTS public.ai_generated_posts CASCADE;
DROP TABLE IF EXISTS public.ai_prompt_templates CASCADE;
DROP TABLE IF EXISTS public.custom_links CASCADE;
DROP TABLE IF EXISTS public.link_groups CASCADE;
DROP TABLE IF EXISTS public.event_templates CASCADE;
DROP TABLE IF EXISTS public.share_analytics CASCADE;
DROP TABLE IF EXISTS public.news_sources CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.site_settings CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Deletar tipos personalizados
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Deletar funções
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.generate_slug(text) CASCADE;
DROP FUNCTION IF EXISTS public.set_event_slug() CASCADE;
DROP FUNCTION IF EXISTS public.set_post_slug() CASCADE;
DROP FUNCTION IF EXISTS public.update_blog_posts_search_vector() CASCADE;
DROP FUNCTION IF EXISTS public.search_blog_posts(text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_post_like(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_liked_post(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_post_views(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_event_views(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_new_group_after_navigation() CASCADE;
```

---

## 🏗️ PASSO 1: Criar Estrutura do Banco

### 1.1 Criar Enums e Tipos Personalizados

```sql
-- Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
```

---

### 1.2 Criar Tabelas Principais

```sql
-- ============================================
-- TABELA: profiles
-- ============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- TABELA: user_roles
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ============================================
-- TABELA: site_settings
-- ============================================
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================
-- TABELA: blog_posts
-- ============================================
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  author_id UUID,
  image_url TEXT,
  published BOOLEAN DEFAULT false NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  search_vector tsvector,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================
-- TABELA: events
-- ============================================
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT NOT NULL UNIQUE,
  venue TEXT NOT NULL,
  address TEXT,
  location_state TEXT NOT NULL,
  location_city TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  end_time TIME,
  genres TEXT[] NOT NULL DEFAULT '{}',
  lineup TEXT[] DEFAULT '{}',
  ticket_link TEXT,
  vip_link TEXT,
  description TEXT,
  image_url TEXT,
  views INTEGER DEFAULT 0,
  blog_post_id UUID,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- TABELA: team_members
-- ============================================
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

-- ============================================
-- TABELA: news_sources
-- ============================================
CREATE TABLE public.news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: ai_prompt_templates
-- ============================================
CREATE TABLE public.ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  required_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'Eventos',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: ai_generated_posts
-- ============================================
CREATE TABLE public.ai_generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.ai_prompt_templates(id),
  source_urls TEXT[],
  prompt_used TEXT,
  model_used TEXT DEFAULT 'google/gemini-2.5-flash',
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: link_groups
-- ============================================
CREATE TABLE public.link_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: custom_links
-- ============================================
CREATE TABLE public.custom_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  url TEXT NOT NULL,
  group_id UUID REFERENCES public.link_groups(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  icon TEXT DEFAULT 'ExternalLink',
  color_gradient TEXT DEFAULT 'from-blue-500 to-cyan-500',
  card_width INTEGER DEFAULT 650,
  card_height INTEGER DEFAULT 60,
  is_featured BOOLEAN DEFAULT false,
  clicks INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: event_templates
-- ============================================
CREATE TABLE public.event_templates (
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

-- ============================================
-- TABELA: blog_post_likes
-- ============================================
CREATE TABLE public.blog_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- ============================================
-- TABELA: newsletter_subscribers
-- ============================================
CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  confirmed BOOLEAN DEFAULT false,
  confirmation_token TEXT,
  unsubscribed_at TIMESTAMPTZ,
  source TEXT
);

-- ============================================
-- TABELA: newsletter_popup_variants
-- ============================================
CREATE TABLE public.newsletter_popup_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  delay_seconds INTEGER DEFAULT 30,
  scroll_percentage INTEGER DEFAULT 50,
  enabled BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: newsletter_popup_analytics
-- ============================================
CREATE TABLE public.newsletter_popup_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES public.newsletter_popup_variants(id),
  session_id TEXT,
  user_fingerprint TEXT,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: share_analytics
-- ============================================
CREATE TABLE public.share_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  referrer TEXT
);

-- ============================================
-- TABELA: sync_logs
-- ============================================
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'warning', 'failed')),
  triggered_by TEXT,
  tables_synced JSONB DEFAULT '[]'::jsonb,
  total_records INTEGER DEFAULT 0,
  storage_files_synced INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar Foreign Key para blog_post_id em events
ALTER TABLE public.events
ADD CONSTRAINT events_blog_post_id_fkey
FOREIGN KEY (blog_post_id) REFERENCES public.blog_posts(id) ON DELETE SET NULL;
```

---

### 1.3 Criar Funções do Banco

```sql
-- ============================================
-- FUNÇÃO: update_updated_at_column
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- FUNÇÃO: handle_new_user
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$;

-- ============================================
-- FUNÇÃO: has_role
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- FUNÇÃO: generate_slug
-- ============================================
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

-- ============================================
-- FUNÇÃO: set_event_slug
-- ============================================
CREATE OR REPLACE FUNCTION public.set_event_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: set_post_slug
-- ============================================
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: update_blog_posts_search_vector
-- ============================================
CREATE OR REPLACE FUNCTION public.update_blog_posts_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNÇÃO: search_blog_posts
-- ============================================
CREATE OR REPLACE FUNCTION public.search_blog_posts(
  search_query text,
  category_filter text DEFAULT NULL,
  limit_results int DEFAULT 10,
  offset_results int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  excerpt text,
  slug text,
  category text,
  image_url text,
  published_at timestamptz,
  rank real,
  headline text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.title,
    bp.excerpt,
    bp.slug,
    bp.category,
    bp.image_url,
    bp.published_at,
    ts_rank(bp.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank,
    ts_headline('portuguese', bp.content, websearch_to_tsquery('portuguese', search_query),
      'MaxWords=50, MinWords=20, ShortWord=3') as headline
  FROM blog_posts bp
  WHERE
    bp.published = true
    AND bp.search_vector @@ websearch_to_tsquery('portuguese', search_query)
    AND (category_filter IS NULL OR bp.category = category_filter)
  ORDER BY rank DESC, bp.published_at DESC
  LIMIT limit_results
  OFFSET offset_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNÇÃO: toggle_post_like
-- ============================================
CREATE OR REPLACE FUNCTION public.toggle_post_like(post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_liked BOOLEAN;
  v_total_likes INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user already liked the post
  SELECT EXISTS(
    SELECT 1 FROM public.blog_post_likes
    WHERE user_id = v_user_id AND blog_post_likes.post_id = toggle_post_like.post_id
  ) INTO v_liked;

  IF v_liked THEN
    -- Unlike: remove like
    DELETE FROM public.blog_post_likes
    WHERE user_id = v_user_id AND blog_post_likes.post_id = toggle_post_like.post_id;

    -- Decrement likes count
    UPDATE public.blog_posts
    SET likes = GREATEST(likes - 1, 0)
    WHERE id = toggle_post_like.post_id;
  ELSE
    -- Like: add like
    INSERT INTO public.blog_post_likes (user_id, post_id)
    VALUES (v_user_id, toggle_post_like.post_id);

    -- Increment likes count
    UPDATE public.blog_posts
    SET likes = likes + 1
    WHERE id = toggle_post_like.post_id;
  END IF;

  -- Get updated total likes
  SELECT likes INTO v_total_likes
  FROM public.blog_posts
  WHERE id = toggle_post_like.post_id;

  RETURN jsonb_build_object(
    'liked', NOT v_liked,
    'total_likes', v_total_likes
  );
END;
$$;

-- ============================================
-- FUNÇÃO: user_liked_post
-- ============================================
CREATE OR REPLACE FUNCTION public.user_liked_post(post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS(
    SELECT 1 FROM public.blog_post_likes
    WHERE user_id = v_user_id AND blog_post_likes.post_id = user_liked_post.post_id
  );
END;
$$;

-- ============================================
-- FUNÇÃO: increment_post_views
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_post_views(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts
  SET views = views + 1
  WHERE id = post_id;
END;
$$;

-- ============================================
-- FUNÇÃO: increment_event_views
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_event_views(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET views = COALESCE(views, 0) + 1
  WHERE id = event_id;
END;
$$;

-- ============================================
-- FUNÇÃO: set_new_group_after_navigation
-- ============================================
CREATE OR REPLACE FUNCTION public.set_new_group_after_navigation()
RETURNS TRIGGER AS $$
DECLARE
  nav_order INTEGER;
  max_order INTEGER;
BEGIN
  -- Buscar ordem do grupo "Navegação"
  SELECT display_order INTO nav_order
  FROM link_groups
  WHERE LOWER(name) = 'navegação' OR LOWER(name) = 'navegacao'
  LIMIT 1;

  -- Se novo grupo não tem display_order definido
  IF NEW.display_order IS NULL THEN
    -- Pegar maior display_order atual
    SELECT COALESCE(MAX(display_order), 0) INTO max_order FROM link_groups;

    -- Se existe grupo "Navegação", colocar depois dele
    IF nav_order IS NOT NULL THEN
      NEW.display_order := GREATEST(nav_order + 1, max_order + 1);
    ELSE
      NEW.display_order := max_order + 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 1.4 Criar Triggers

```sql
-- Trigger para novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_link_groups_updated_at
  BEFORE UPDATE ON public.link_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_links_updated_at
  BEFORE UPDATE ON public.custom_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_templates_updated_at
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers para slugs
CREATE TRIGGER events_slug_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION set_event_slug();

CREATE TRIGGER blog_posts_slug_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_post_slug();

-- Trigger para search vector do blog
CREATE TRIGGER update_blog_posts_search_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_posts_search_vector();

-- Trigger para ordenação de grupos
CREATE TRIGGER ensure_group_after_navigation
  BEFORE INSERT ON link_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_new_group_after_navigation();
```

---

### 1.5 Criar Storage Buckets

```sql
-- Bucket para imagens de eventos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para imagens de equipe
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-images', 'team-images', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para thumbnails de links
INSERT INTO storage.buckets (id, name, public)
VALUES ('link-thumbnails', 'link-thumbnails', true)
ON CONFLICT (id) DO NOTHING;
```

---

### 1.6 Habilitar RLS em Todas as Tabelas

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_popup_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_popup_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
```

---

### 1.7 Criar RLS Policies

```sql
-- ============================================
-- POLICIES: profiles
-- ============================================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- POLICIES: user_roles
-- ============================================
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: site_settings
-- ============================================
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

-- ============================================
-- POLICIES: blog_posts
-- ============================================
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

-- ============================================
-- POLICIES: events
-- ============================================
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: team_members
-- ============================================
CREATE POLICY "Todos podem ver membros ativos"
  ON public.team_members FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir membros"
  ON public.team_members FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar membros"
  ON public.team_members FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar membros"
  ON public.team_members FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: news_sources
-- ============================================
CREATE POLICY "Admins can manage news sources"
  ON public.news_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: ai_prompt_templates
-- ============================================
CREATE POLICY "Admins can manage prompt templates"
  ON public.ai_prompt_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view prompt templates"
  ON public.ai_prompt_templates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: ai_generated_posts
-- ============================================
CREATE POLICY "Admins can view AI posts"
  ON public.ai_generated_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert AI posts"
  ON public.ai_generated_posts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: link_groups
-- ============================================
CREATE POLICY "Anyone can view enabled link groups"
  ON public.link_groups FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage link groups"
  ON public.link_groups FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: custom_links
-- ============================================
CREATE POLICY "Anyone can view enabled links"
  ON public.custom_links FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage custom links"
  ON public.custom_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: event_templates
-- ============================================
CREATE POLICY "Admins podem ver templates"
  ON public.event_templates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar templates"
  ON public.event_templates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar templates"
  ON public.event_templates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar templates"
  ON public.event_templates FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: blog_post_likes
-- ============================================
CREATE POLICY "Users can view their own likes"
  ON public.blog_post_likes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own likes"
  ON public.blog_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.blog_post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: newsletter_subscribers
-- ============================================
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all subscribers"
  ON newsletter_subscribers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: newsletter_popup_variants
-- ============================================
CREATE POLICY "Anyone can view enabled variants"
  ON public.newsletter_popup_variants FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage variants"
  ON public.newsletter_popup_variants FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: newsletter_popup_analytics
-- ============================================
CREATE POLICY "Anyone can insert analytics"
  ON newsletter_popup_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view analytics"
  ON newsletter_popup_analytics FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: share_analytics
-- ============================================
CREATE POLICY "Anyone can track shares"
  ON share_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view share analytics"
  ON share_analytics FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- POLICIES: sync_logs
-- ============================================
CREATE POLICY "Admins can view sync logs"
  ON public.sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert sync logs"
  ON public.sync_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync logs"
  ON public.sync_logs FOR UPDATE
  USING (true);

-- ============================================
-- STORAGE POLICIES: event-images
-- ============================================
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

-- ============================================
-- STORAGE POLICIES: team-images
-- ============================================
CREATE POLICY "Imagens de equipe são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-images');

CREATE POLICY "Admins podem fazer upload de imagens de equipe"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar imagens de equipe"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar imagens de equipe"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'team-images' AND has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- STORAGE POLICIES: link-thumbnails
-- ============================================
CREATE POLICY "Link thumbnails são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'link-thumbnails');

CREATE POLICY "Admins podem fazer upload de link thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'link-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar link thumbnails"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'link-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar link thumbnails"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'link-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));
```

---

### 1.8 Políticas RLS para Service Role (Sincronização Externa)

**IMPORTANTE**: Estas políticas são necessárias para que o sync externo funcione corretamente.

```sql
-- ================================================
-- POLÍTICAS RLS PARA SERVICE ROLE
-- ================================================
-- O service_role precisa de permissões explícitas para o sync funcionar

CREATE POLICY "Service role can manage profiles"
ON public.profiles FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage user_roles"
ON public.user_roles FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage team_members"
ON public.team_members FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage link_groups"
ON public.link_groups FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage custom_links"
ON public.custom_links FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage events"
ON public.events FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage blog_posts"
ON public.blog_posts FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage blog_post_likes"
ON public.blog_post_likes FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage ai_prompt_templates"
ON public.ai_prompt_templates FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage ai_generated_posts"
ON public.ai_generated_posts FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage news_sources"
ON public.news_sources FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage newsletter_popup_variants"
ON public.newsletter_popup_variants FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage newsletter_subscribers"
ON public.newsletter_subscribers FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage newsletter_popup_analytics"
ON public.newsletter_popup_analytics FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage share_analytics"
ON public.share_analytics FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage site_settings"
ON public.site_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sync_logs"
ON public.sync_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

---

### 1.9 Criar Índices para Performance

```sql
-- Índices para blog_posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON public.blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON public.blog_posts USING gin(search_vector);

-- Índices para events
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_location_state ON public.events(location_state);
CREATE INDEX IF NOT EXISTS idx_events_location_city ON public.events(location_city);

-- Índices para team_members
CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members(active);
CREATE INDEX IF NOT EXISTS idx_team_members_display_order ON public.team_members(display_order);

-- Índices para link_groups e custom_links
CREATE INDEX IF NOT EXISTS idx_link_groups_display_order ON public.link_groups(display_order);
CREATE INDEX IF NOT EXISTS idx_custom_links_group_id ON public.custom_links(group_id);
CREATE INDEX IF NOT EXISTS idx_custom_links_display_order ON public.custom_links(display_order);

-- Índices para blog_post_likes
CREATE INDEX IF NOT EXISTS idx_blog_post_likes_user_post ON public.blog_post_likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_likes_post ON public.blog_post_likes(post_id);

-- Índices para newsletter
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_confirmed ON newsletter_subscribers(confirmed);

-- Índices para share_analytics
CREATE INDEX IF NOT EXISTS idx_share_analytics_url ON share_analytics(url);
CREATE INDEX IF NOT EXISTS idx_share_analytics_platform ON share_analytics(platform);

-- Índices para sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
```

---

### 1.10 Seeds Iniciais (Dados de Exemplo)

```sql
-- Inserir configurações do site
INSERT INTO site_settings (key, value) VALUES
  ('whatsapp_number', '5511999999999'),
  ('whatsapp_link', 'https://wa.me/5511999999999'),
  ('instagram_link', 'https://instagram.com/mdaccula'),
  ('soundcloud_link', 'https://soundcloud.com/mdaccula'),
  ('contact_email', 'contato@mdaccula.com'),
  ('spotify_playlist_id', ''),
  ('links_page_avatar_url', NULL),
  ('links_page_handle', '@MDAccula'),
  ('links_page_theme', 'sunset')
ON CONFLICT (key) DO NOTHING;

-- Inserir grupos de links
INSERT INTO public.link_groups (name, display_order, enabled) VALUES
  ('Redes Sociais', 0, true),
  ('Navegação', 1, true)
ON CONFLICT DO NOTHING;

-- Inserir templates de eventos
INSERT INTO public.event_templates (name, venue, address, location_city, location_state, genres) VALUES
  ('The Year', 'The Year', 'Rua Barra Funda, 1020 - Barra Funda', 'São Paulo', 'SP', ARRAY['Techno', 'House', 'Tech House']),
  ('Sonora Garden', 'Sonora Garden', 'Av. Bento Gonçalves, 123', 'São Paulo', 'SP', ARRAY['House', 'Deep House', 'Melodic'])
ON CONFLICT (name) DO NOTHING;
```

---

## 🔄 PASSO 2: Próximos Passos para Sincronização

Após executar todo o SQL acima no seu Supabase externo, siga estes passos:

### 2.1 Verificar Criação das Tabelas

Execute este comando para verificar se todas as tabelas foram criadas:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 2.2 Configurar Variáveis de Ambiente

No seu Supabase externo, você precisará das seguintes informações:

- `EXTERNAL_SUPABASE_URL` - URL do projeto Supabase externo
- `EXTERNAL_SUPABASE_SERVICE_KEY` - Service Role Key (não a anon key!)

### 2.3 Adicionar Service Role Key no Lovable

1. Acesse `/admin/backup-sync`
2. Cole a URL e Service Role Key do Supabase externo
3. Clique em "Testar Conexão"
4. Se conexão OK, clique em "Sincronizar Agora"

### 2.4 Verificar Sincronização

Execute este comando no Supabase externo para ver os logs de sync:

```sql
SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 5;
```

### 2.5 Criar Usuário Admin

**IMPORTANTE**: Após a sincronização, você precisará criar um usuário admin manualmente no Supabase externo:

```sql
-- Substitua pelo email do usuário admin que você criou no auth
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'seu-email@example.com'
ON CONFLICT DO NOTHING;
```

---

## ✅ Checklist Final

- [x ] Executei todo o SQL de criação de tabelas
- [ x] Verifiquei que todas as tabelas foram criadas
- [ ]x Adicionei os buckets de storage
- [x ] Configurei as RLS policies
- [x ] Testei a conexão no `/admin/backup-sync`
- [ ] Executei a primeira sincronização
- [ ] Verifiquei os logs de sync
- [ ] Criei usuário admin no banco externo
- [ ] Testei login no sistema

---

## 📚 Tabelas Criadas

Total: **18 tabelas**

1. `profiles` - Perfis de usuário
2. `user_roles` - Roles de usuário (admin, moderator, user)
3. `site_settings` - Configurações do site
4. `blog_posts` - Posts do blog
5. `events` - Eventos
6. `team_members` - Membros da equipe
7. `news_sources` - Fontes de notícias
8. `ai_prompt_templates` - Templates de prompts para IA
9. `ai_generated_posts` - Posts gerados por IA
10. `link_groups` - Grupos de links personalizados
11. `custom_links` - Links personalizados
12. `event_templates` - Templates de eventos
13. `blog_post_likes` - Likes em posts do blog
14. `newsletter_subscribers` - Inscritos na newsletter
15. `newsletter_popup_variants` - Variantes de popup da newsletter
16. `newsletter_popup_analytics` - Analytics do popup
17. `share_analytics` - Analytics de compartilhamento
18. `sync_logs` - Logs de sincronização

---

## 🎯 Observações Importantes

1. **Service Role Key**: É ESSENCIAL para a sincronização. Nunca compartilhe essa chave!
2. **RLS Policies**: Todas as tabelas têm RLS ativado. Sem as policies corretas, você não conseguirá acessar dados.
3. **Admin User**: Lembre-se de criar pelo menos um usuário admin após a sincronização.
4. **Backup Regular**: Configure backups automáticos no Supabase externo.
5. **Monitoramento**: Verifique os `sync_logs` regularmente para identificar problemas.

---

**Pronto!** Após seguir todos esses passos, seu banco de dados estará completamente configurado e pronto para receber sincronizações do sistema principal. 🚀
