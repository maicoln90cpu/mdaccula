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

-- news_sources acima é obsoleta (substituída por event_sources) — não é
-- mais criada por este script, então não precisa ser dropada num banco novo.

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
-- Atualizado em 17/07/2026 a partir do schema real (information_schema.columns) —
-- a versão anterior deste arquivo estava desatualizada há vários meses (faltavam
-- pix_button_enabled, tickets_per_day, status, merge de festivais, geocoding, etc.).
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
  end_date DATE,
  time TIME,
  end_time TIME,
  genres TEXT[] NOT NULL DEFAULT '{}',
  lineup TEXT[] DEFAULT '{}',
  description TEXT,
  schedule JSONB, -- programação por dia (festivais multi-dia), ver src/lib/eventScheduleHelper.ts
  ticket_link TEXT,
  vip_link TEXT,
  pix_button_enabled BOOLEAN NOT NULL DEFAULT false, -- botão "Pix sem taxa" via WhatsApp
  tickets_per_day BOOLEAN NOT NULL DEFAULT false, -- festival com 1 link de venda por dia
  cta_type TEXT NOT NULL DEFAULT 'buy_ticket'
    CHECK (cta_type IN ('buy_ticket', 'buy_ticket_discount', 'guest_list', 'courtesy')),
    -- tipo de botão/CTA do evento (site + e-mails) — ver supabase/functions/_shared/eventCta.ts
  image_url TEXT,
  views INTEGER DEFAULT 0,
  blog_post_id UUID REFERENCES public.blog_posts(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'merged_inactive' (evento mesclado num festival)
  ai_context TEXT, -- instruções extras pro admin injetar na geração de artigo por IA
  dispatch_email_on_save BOOLEAN NOT NULL DEFAULT false,
  email_campaign_dispatched_at TIMESTAMP WITH TIME ZONE, -- anti-race do disparo de e-mail (B.6)
  merged_into_id UUID REFERENCES public.events(id), -- evento "guarda-chuva" quando este foi mesclado
  merged_at TIMESTAMP WITH TIME ZONE,
  recurring_event_config_id UUID REFERENCES public.recurring_event_configs(id) ON DELETE SET NULL, -- preenchido por create-recurring-events; usado pra excluir recorrentes da automação "Lembrete de evento"
  venue_lat NUMERIC,
  venue_lng NUMERIC,
  latitude NUMERIC, -- coordenadas geocodificadas (podem divergir de venue_lat/lng)
  longitude NUMERIC,
  geocoded_at TIMESTAMP WITH TIME ZONE,
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
-- ⚠️ OBSOLETA (04/08/2026): esta tabela NÃO EXISTE no schema real de produção.
-- Foi substituída por `event_sources` (ver seção "Tabelas adicionadas em
-- 04/08/2026" mais abaixo). Mantida aqui só como registro histórico — não
-- execute este CREATE TABLE ao recriar o banco do zero.
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

### 1.2-B Tabelas adicionadas em 04/08/2026

> As 25 tabelas abaixo foram criadas depois deste script original e nunca tinham ganho DDL aqui —
> gap identificado e corrigido em 04/08/2026 (ver `docs/PENDENCIAS.md` e `docs/DATABASE_SCHEMA.md`).
> Levantadas a partir do schema real via Supabase MCP (`information_schema`, `pg_policies`,
> `pg_indexes`). Agrupadas pelos mesmos domínios de `docs/DATABASE_SCHEMA.md`.

#### 🎪 Eventos

```sql
-- ============================================
-- TABELA: recurring_event_configs
-- ============================================
-- Configuração de eventos automáticos recorrentes (ex.: toda sexta-feira);
-- o cron gera instâncias em `events` a partir daqui.
CREATE TABLE public.recurring_event_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  venue TEXT NOT NULL,
  address TEXT,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  weekday INTEGER NOT NULL, -- 0=domingo .. 6=sábado
  time TIME NOT NULL,
  end_time TIME,
  genres TEXT[] DEFAULT '{}',
  ticket_link TEXT,
  vip_link TEXT,
  image_url TEXT,
  link_group_id UUID REFERENCES public.link_groups(id), -- sem ON DELETE definido (NO ACTION) — ver observação abaixo
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.recurring_event_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recurring configs"
  ON public.recurring_event_configs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- TABELA: event_sources
-- ============================================
-- Fontes externas (sites/perfis) monitoradas automaticamente para descobrir
-- novos eventos a publicar. Substitui a antiga `news_sources` (obsoleta).
CREATE TABLE public.event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'site' CHECK (type IN ('site', 'instagram')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  last_seen_post_id TEXT, -- cursor/checkpoint da última página/post já processado
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_sources_enabled ON public.event_sources(enabled);

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event sources"
  ON public.event_sources FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER trg_event_sources_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: event_watch_drafts
-- ============================================
-- Rascunhos extraídos automaticamente de `event_sources` aguardando revisão
-- humana antes de virarem `events`/`blog_posts` publicados.
CREATE TABLE public.event_watch_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  extracted_title TEXT NOT NULL,
  extracted_date DATE NOT NULL,
  extracted_time TIME,
  extracted_venue TEXT,
  extracted_address TEXT,
  extracted_city TEXT,
  extracted_state TEXT,
  extracted_lineup TEXT[] DEFAULT '{}',
  extracted_ticket_link TEXT,
  extracted_description TEXT,
  extracted_confidence TEXT NOT NULL DEFAULT 'low'
    CHECK (extracted_confidence IN ('high', 'medium', 'low')), -- confiança da extração por IA
  source_raw_excerpt TEXT, -- trecho bruto da fonte usado como evidência na revisão
  source_page_url TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  published_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  published_blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_watch_drafts_source_id ON public.event_watch_drafts(source_id);
CREATE INDEX idx_event_watch_drafts_status ON public.event_watch_drafts(status);

ALTER TABLE public.event_watch_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event watch drafts"
  ON public.event_watch_drafts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER trg_event_watch_drafts_updated_at
  BEFORE UPDATE ON public.event_watch_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: event_slug_redirects
-- ============================================
-- Mapeia slugs antigos de evento para o evento atual, evitando 404 quando
-- um slug muda (ex.: evento renomeado/mesclado).
CREATE TABLE public.event_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_slug_redirects_event ON public.event_slug_redirects(event_id);

ALTER TABLE public.event_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view slug redirects"
  ON public.event_slug_redirects FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage slug redirects"
  ON public.event_slug_redirects FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Service role can manage slug redirects"
  ON public.event_slug_redirects FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

#### 🔗 Links/Redirect

```sql
-- ============================================
-- TABELA: redirect_links
-- ============================================
-- Encurtador/redirecionador de UTM links de campanha (rota `/r/slug`) com
-- contagem de cliques agregada (ver `redirect_click_events` para granular).
CREATE TABLE public.redirect_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  description TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.redirect_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled redirect links"
  ON public.redirect_links FOR SELECT
  USING (enabled = true OR is_admin());

CREATE POLICY "Admins can manage redirect links"
  ON public.redirect_links FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
```

#### 📊 Tracking/Analytics

```sql
-- ============================================
-- TABELA: redirect_click_events
-- ============================================
-- Evento individual de clique num redirect link (granular, além do contador
-- agregado em redirect_links.clicks).
CREATE TABLE public.redirect_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redirect_link_id UUID NOT NULL REFERENCES public.redirect_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT -- hash do IP, nunca o IP em texto puro
);

CREATE INDEX idx_redirect_click_events_link_clicked
  ON public.redirect_click_events(redirect_link_id, clicked_at DESC);

ALTER TABLE public.redirect_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert redirect clicks"
  ON public.redirect_click_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view click events"
  ON public.redirect_click_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can manage redirect_click_events"
  ON public.redirect_click_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: link_click_events
-- ============================================
-- Evento individual de clique num link da página de links (Linktree-style).
CREATE TABLE public.link_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.custom_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT
);

CREATE INDEX idx_link_click_events_link_id ON public.link_click_events(link_id);
CREATE INDEX idx_link_click_events_clicked_at ON public.link_click_events(clicked_at);

ALTER TABLE public.link_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert link clicks"
  ON public.link_click_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view link click events"
  ON public.link_click_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can manage link_click_events"
  ON public.link_click_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: blog_view_events
-- ============================================
-- Evento individual de visualização de post do blog.
CREATE TABLE public.blog_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT
);

CREATE INDEX idx_blog_view_events_post_id ON public.blog_view_events(post_id);
CREATE INDEX idx_blog_view_events_viewed_at ON public.blog_view_events(viewed_at);

ALTER TABLE public.blog_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert blog views"
  ON public.blog_view_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view blog view events"
  ON public.blog_view_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can manage blog_view_events"
  ON public.blog_view_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: event_view_events
-- ============================================
-- Evento individual de visualização de página de evento.
CREATE TABLE public.event_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT
);

CREATE INDEX idx_event_view_events_event_id ON public.event_view_events(event_id);
CREATE INDEX idx_event_view_events_viewed_at ON public.event_view_events(viewed_at);

ALTER TABLE public.event_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert event views"
  ON public.event_view_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view event view events"
  ON public.event_view_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can manage event_view_events"
  ON public.event_view_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: egress_metrics
-- ============================================
-- Métricas agregadas de egress/banda (Supabase/Bunny) por rota e período,
-- usadas para monitorar custo de infraestrutura.
CREATE TABLE public.egress_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  api_path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sw', -- ex.: 'sw' (service worker), 'edge', etc.
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  egress_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_egress_metrics_unique
  ON public.egress_metrics(period_start, api_path, source);
CREATE INDEX idx_egress_metrics_period ON public.egress_metrics(period_start DESC);

ALTER TABLE public.egress_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert egress metrics"
  ON public.egress_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view egress metrics"
  ON public.egress_metrics FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can manage egress_metrics"
  ON public.egress_metrics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: metrics_snapshots
-- ============================================
-- Snapshot diário consolidado de uso/custo de Supabase e Bunny CDN.
CREATE TABLE public.metrics_snapshots (
  day DATE PRIMARY KEY,
  supabase JSONB NOT NULL DEFAULT '{}'::jsonb,
  bunny JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_snapshots_day_desc ON public.metrics_snapshots(day DESC);

ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view metrics_snapshots"
  ON public.metrics_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage metrics_snapshots"
  ON public.metrics_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

#### 📧 E-mail/E-goi

```sql
-- ============================================
-- TABELA: email_templates
-- ============================================
-- Templates de e-mail (estrutura em blocos) usados para montar campanhas de
-- divulgação. Definida ANTES de egoi_config porque este referencia aquele.
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'event_new', 'ticket_batch', 'ticket_batch_multi', 'weekly_digest',
    'weekly_digest_editorial', 'weekend_agenda', 'courtesy', 'custom', 'blog_digest',
    'event_reminder', 'promo'
  )),
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb, -- estrutura em blocos editável no admin
  is_default BOOLEAN NOT NULL DEFAULT false,
  subject_template TEXT,
  preheader_template TEXT,
  created_by UUID, -- sem FK para profiles/auth.users (ver observações)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates"
  ON public.email_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: egoi_config
-- ============================================
-- Configuração singleton de integração com a plataforma de e-mail marketing
-- E-goi (lista, remetente, agendamento).
CREATE TABLE public.egoi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id INTEGER,
  sender_id INTEGER,
  mode TEXT NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'immediate', 'scheduled')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  scheduled_days_before INTEGER,
  segment_id INTEGER,
  default_event_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE CHECK (singleton = true), -- garante linha única
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.egoi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage egoi_config"
  ON public.egoi_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages egoi_config"
  ON public.egoi_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_egoi_config_updated_at
  BEFORE UPDATE ON public.egoi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: event_email_campaigns
-- ============================================
-- Uma campanha de e-mail disparada (ou agendada) na E-goi para divulgar um
-- evento específico, com suporte a teste A/B.
CREATE TABLE public.event_email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- event_id aceita NULL desde 09/08/2026 (migration
  -- 20260809120000_event_email_campaigns_event_id_nullable.sql) — automações
  -- sem evento associado (blog-digest-draft) gravam uma linha com event_id
  -- null em vez de ficarem invisíveis no histórico. Ver R-044 em TESTING.md.
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  egoi_campaign_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  mode TEXT NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'immediate', 'scheduled', 'manual')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  campaign_type TEXT NOT NULL DEFAULT 'standard',
  ab_group_id UUID, -- agrupa as variantes de um mesmo teste A/B
  ab_variant TEXT,
  ab_test_config JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  scheduled_send_claimed_at TIMESTAMP WITH TIME ZONE, -- lock otimista contra double-send do cron
  scheduled_send_attempts INTEGER NOT NULL DEFAULT 0,
  segment_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX event_email_campaigns_event_created_idx
  ON public.event_email_campaigns(event_id, created_at DESC);
CREATE INDEX event_email_campaigns_ab_group_idx
  ON public.event_email_campaigns(ab_group_id) WHERE (ab_group_id IS NOT NULL);
CREATE INDEX event_email_campaigns_scheduled_due_idx
  ON public.event_email_campaigns(scheduled_at)
  WHERE (status = 'scheduled' AND scheduled_send_claimed_at IS NULL);

ALTER TABLE public.event_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event_email_campaigns"
  ON public.event_email_campaigns FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages event_email_campaigns"
  ON public.event_email_campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_event_email_campaigns_updated_at
  BEFORE UPDATE ON public.event_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: event_email_campaign_stats
-- ============================================
-- Estatísticas de entrega/abertura/clique de uma campanha, sincronizadas
-- periodicamente da E-goi.
CREATE TABLE public.event_email_campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES public.event_email_campaigns(id) ON DELETE CASCADE,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice redundante com a UNIQUE acima (mantido pois existe assim no banco real)
CREATE INDEX idx_event_email_campaign_stats_campaign_id
  ON public.event_email_campaign_stats(campaign_id);

ALTER TABLE public.event_email_campaign_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaign stats"
  ON public.event_email_campaign_stats FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can select campaign stats"
  ON public.event_email_campaign_stats FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- TABELA: email_template_settings
-- ============================================
-- Configuração visual singleton (branding) aplicada a todos os templates de
-- e-mail gerados.
CREATE TABLE public.email_template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  brand_name TEXT NOT NULL DEFAULT 'MDACCULA',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#a855f7',
  accent_color TEXT NOT NULL DEFAULT '#ec4899',
  background_color TEXT NOT NULL DEFAULT '#050505',
  footer_text TEXT NOT NULL DEFAULT 'Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de Cuiabá-MT.',
  cta_label TEXT NOT NULL DEFAULT 'Garantir ingresso',
  instagram_url TEXT DEFAULT 'https://instagram.com/mdaccula',
  youtube_url TEXT DEFAULT 'https://youtube.com/@mdaccula',
  tiktok_url TEXT DEFAULT 'https://tiktok.com/@mdaccula',
  show_subtitle BOOLEAN NOT NULL DEFAULT true,
  show_description BOOLEAN NOT NULL DEFAULT true,
  show_socials BOOLEAN NOT NULL DEFAULT true,
  show_secondary_link BOOLEAN NOT NULL DEFAULT true,
  secondary_link_label TEXT NOT NULL DEFAULT 'Ver agenda completa no site',
  custom_html_header TEXT,
  custom_html_footer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email template settings"
  ON public.email_template_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert email template settings"
  ON public.email_template_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email template settings"
  ON public.email_template_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email template settings"
  ON public.email_template_settings FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_update_email_template_settings_updated_at
  BEFORE UPDATE ON public.email_template_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: egoi_resources_cache
-- ============================================
-- Cache local singleton das listas/remetentes vindos da API da E-goi,
-- evitando chamadas repetidas.
CREATE TABLE public.egoi_resources_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  lists JSONB NOT NULL DEFAULT '[]'::jsonb,
  senders JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.egoi_resources_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read egoi cache"
  ON public.egoi_resources_cache FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins write egoi cache"
  ON public.egoi_resources_cache FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_egoi_resources_cache_updated_at
  BEFORE UPDATE ON public.egoi_resources_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: daily_metrics_email_log
-- ============================================
-- Log de envio do e-mail diário de métricas para a equipe (sucesso/erro do
-- disparo, escrito apenas pelo cron via service_role).
CREATE TABLE public.daily_metrics_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT
);

CREATE INDEX idx_daily_metrics_email_log_sent_at ON public.daily_metrics_email_log(sent_at DESC);

ALTER TABLE public.daily_metrics_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view daily metrics email log"
  ON public.daily_metrics_email_log FOR SELECT
  TO authenticated
  USING (is_admin());
```

#### 🖥️ Sistema/Infra

```sql
-- ============================================
-- TABELA: application_logs
-- ============================================
-- Log centralizado de aplicação (frontend/edge functions) para o `logger`
-- do projeto (src/lib/logger.ts).
CREATE TABLE public.application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL, -- 'debug' | 'info' | 'warn' | 'error'
  message TEXT NOT NULL,
  error_message TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  user_agent TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- Nome da policy diz "Service role" mas roles={public} — qualquer
-- role (inclusive anon) pode inserir logs de erro do frontend. Nome
-- desatualizado, não é bug funcional (esperado que o `logger` do frontend
-- grave direto via anon key).
CREATE POLICY "Service role can insert logs"
  ON public.application_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read logs"
  ON public.application_logs FOR SELECT
  USING (is_admin());

-- ============================================
-- TABELA: performance_metrics
-- ============================================
-- Métricas de performance (ex.: tempo de carregamento, duração de operações)
-- reportadas pelo frontend.
CREATE TABLE public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert metrics"
  ON public.performance_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read metrics"
  ON public.performance_metrics FOR SELECT
  USING (is_admin());

-- ============================================
-- TABELA: image_hashes
-- ============================================
-- Índice de hashes de imagens já enviadas ao Storage, usado para deduplicar
-- uploads.
CREATE TABLE public.image_hashes (
  hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  bucket TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view image_hashes"
  ON public.image_hashes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage image_hashes"
  ON public.image_hashes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: internal_cron_secrets
-- ============================================
-- Segredos usados para autenticar chamadas internas de cron/webhook às Edge
-- Functions. RLS habilitada SEM NENHUMA policy — nenhum papel (anon,
-- authenticated, nem admin autenticado via app) consegue ler/gravar por
-- PostgREST; somente o service_role (que ignora RLS) acessa esta tabela.
CREATE TABLE public.internal_cron_secrets (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_cron_secrets ENABLE ROW LEVEL SECURITY;
-- (nenhuma CREATE POLICY — deny-all intencional, ver comentário acima)

-- ============================================
-- TABELA: egress_alerts
-- ============================================
-- Alertas disparados quando o egress/banda ultrapassa um limiar configurado,
-- com envio de e-mail de notificação.
CREATE TABLE public.egress_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  api_path TEXT,
  source TEXT,
  window_bytes BIGINT NOT NULL DEFAULT 0,
  baseline_bytes BIGINT NOT NULL DEFAULT 0,
  ratio NUMERIC(10,2),
  threshold_mb INTEGER,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_egress_alerts_triggered ON public.egress_alerts(triggered_at DESC);

ALTER TABLE public.egress_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view egress alerts"
  ON public.egress_alerts FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- TABELA: email_global_blocks
-- ============================================
-- Bloqueios globais de envio de e-mail (ex.: categoria/tipo de e-mail
-- suspenso administrativamente).
CREATE TABLE public.email_global_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  block JSONB NOT NULL, -- sem valor default; todo insert deve informar
  created_by UUID, -- sem FK para profiles/auth.users (ver observações)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_global_blocks_category ON public.email_global_blocks(category);

ALTER TABLE public.email_global_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read global blocks"
  ON public.email_global_blocks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage global blocks"
  ON public.email_global_blocks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_email_global_blocks_updated_at
  BEFORE UPDATE ON public.email_global_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

#### 🎤 Outros

```sql
-- ============================================
-- TABELA: podcast_submissions
-- ============================================
-- Inscrições de DJs no programa de podcast (formulário público), com
-- revisão administrativa via `status`/`admin_notes`.
CREATE TABLE public.podcast_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_age TEXT NOT NULL, -- tempo de existência do projeto/carreira
  genre TEXT NOT NULL,
  project_description TEXT NOT NULL,
  has_original_track BOOLEAN DEFAULT false,
  original_track_link TEXT,
  instagram TEXT,
  spotify TEXT,
  soundcloud TEXT,
  tiktok TEXT,
  admin_notes TEXT,
  notification_sent BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit podcast registration"
  ON public.podcast_submissions FOR INSERT
  WITH CHECK (
    is_valid_email(email)
    AND length(email) <= 320
    AND length(full_name) >= 3
    AND length(project_name) >= 2
    AND length(project_description) >= 20
  );

CREATE POLICY "Admins can view podcast submissions"
  ON public.podcast_submissions FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update podcast submissions"
  ON public.podcast_submissions FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete podcast submissions"
  ON public.podcast_submissions FOR DELETE
  USING (is_admin());
```

**Particularidades encontradas (conferir antes de tratar como definitivo):**

1. `internal_cron_secrets` — RLS habilitada mas **zero policies** (deny-all via PostgREST; só `service_role` acessa). Parece intencional para uma tabela de segredos — confirmar que nenhuma function depende de acesso via `anon`/`authenticated`.
2. `recurring_event_configs.link_group_id` — FK sem `ON DELETE` explícito (`NO ACTION`), diferente do padrão `SET NULL`/`CASCADE` do resto do schema. Deletar um `link_group` referenciado vai falhar por FK em vez de fazer `SET NULL`.
3. `application_logs`/`performance_metrics` — a policy de INSERT se chama "Service role can insert..." mas na prática aceita qualquer role (`WITH CHECK (true)`, sem restrição de role). Nome desatualizado, não é bug funcional.
4. Sem FK apesar do nome sugerir relação: `email_templates.created_by`, `email_global_blocks.created_by` (ambos `uuid`, sem constraint) — inconsistente com `events.created_by`, que tem FK.
5. Tabelas com `updated_at` mas **sem trigger automático**: `recurring_event_configs`, `redirect_links`, `podcast_submissions`, `internal_cron_secrets`, `event_email_campaign_stats`. Nessas, `updated_at` só muda se a aplicação setar manualmente.

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

-- Bucket de fallback para imagens de mapa estático de evento (2ª fonte de
-- verdade quando o Bunny CDN não confirma o cache, evita re-chamar a API
-- do Google Maps por causa de um hiccup do Bunny)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-map-images', 'event-map-images', true)
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
-- news_sources: obsoleta, ver nota acima em "1.2 Criar Tabelas Principais".
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
-- POLICIES: news_sources (obsoleta, ver nota em "1.2 Criar Tabelas Principais")
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

-- ============================================
-- STORAGE POLICIES: event-map-images
-- ============================================
CREATE POLICY "Public can view event map images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-map-images');

CREATE POLICY "Admins can upload event map images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event map images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event map images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));
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

-- Obsoleta, ver nota em "1.2 Criar Tabelas Principais".
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

Total original deste script: **18 tabelas** (+ 25 tabelas adicionadas retroativamente em 04/08/2026,
ver seção logo abaixo — total real em produção: 42 tabelas, confirmado via Supabase MCP).

1. `profiles` - Perfis de usuário
2. `user_roles` - Roles de usuário (admin, moderator, user)
3. `site_settings` - Configurações do site
4. `blog_posts` - Posts do blog
5. `events` - Eventos
6. `team_members` - Membros da equipe
7. ~~`news_sources` - Fontes de notícias~~ — **obsoleta, não existe mais em produção** (substituída por `event_sources`, ver abaixo)
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

## 🆕 Atualização de 04/08/2026

As 25 tabelas da seção **"1.2-B Tabelas adicionadas em 04/08/2026"** foram incluídas retroativamente
neste arquivo, a partir do schema real de produção (via Supabase MCP), corrigindo o gap registrado em
`docs/PENDENCIAS.md` e apontado em `docs/DATABASE_SCHEMA.md`. A tabela `news_sources` (item 7 da
lista acima) está marcada como **obsoleta** — não existe mais em produção, foi substituída por
`event_sources`.

---

## 🎯 Observações Importantes

1. **Service Role Key**: É ESSENCIAL para a sincronização. Nunca compartilhe essa chave!
2. **RLS Policies**: Todas as tabelas têm RLS ativado. Sem as policies corretas, você não conseguirá acessar dados.
3. **Admin User**: Lembre-se de criar pelo menos um usuário admin após a sincronização.
4. **Backup Regular**: Configure backups automáticos no Supabase externo.
5. **Monitoramento**: Verifique os `sync_logs` regularmente para identificar problemas.

---

**Pronto!** Após seguir todos esses passos, seu banco de dados estará completamente configurado e pronto para receber sincronizações do sistema principal. 🚀
