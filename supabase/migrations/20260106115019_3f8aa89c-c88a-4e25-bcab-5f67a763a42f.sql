-- ============================================
-- FASE 7: Otimização de Policies RLS
-- ============================================

-- 1. Criar função helper is_admin() para simplificar policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- 2. Criar função is_authenticated() para verificações básicas
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 3. Remover policies SELECT redundantes onde já existe ALL
-- (ai_prompt_templates tem ALL + SELECT separado)
DROP POLICY IF EXISTS "Admins can view prompt templates" ON public.ai_prompt_templates;

-- 4. Consolidar link_groups (remover SELECT redundante)
DROP POLICY IF EXISTS "Anyone can view enabled link groups" ON public.link_groups;
DROP POLICY IF EXISTS "Admins can manage link groups" ON public.link_groups;

CREATE POLICY "Public can view enabled link groups"
ON public.link_groups
FOR SELECT
USING (enabled = true OR public.is_admin());

CREATE POLICY "Admins can manage link groups"
ON public.link_groups
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Consolidar custom_links (remover SELECT redundante)
DROP POLICY IF EXISTS "Anyone can view enabled links" ON public.custom_links;
DROP POLICY IF EXISTS "Admins can manage custom links" ON public.custom_links;

CREATE POLICY "Public can view enabled links"
ON public.custom_links
FOR SELECT
USING (enabled = true OR public.is_admin());

CREATE POLICY "Admins can manage custom links"
ON public.custom_links
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Consolidar newsletter_popup_variants
DROP POLICY IF EXISTS "Anyone can view enabled variants" ON public.newsletter_popup_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON public.newsletter_popup_variants;

CREATE POLICY "Public can view enabled variants"
ON public.newsletter_popup_variants
FOR SELECT
USING (enabled = true OR public.is_admin());

CREATE POLICY "Admins can manage variants"
ON public.newsletter_popup_variants
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 7. Otimizar blog_posts com nova função
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can delete posts" ON public.blog_posts;

CREATE POLICY "Public can view published posts"
ON public.blog_posts
FOR SELECT
USING (published = true OR public.is_admin());

CREATE POLICY "Admins can manage posts"
ON public.blog_posts
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 8. Otimizar events com nova função
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Anyone can view events"
ON public.events
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage events"
ON public.events
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 9. Otimizar team_members com nova função
DROP POLICY IF EXISTS "Todos podem ver membros ativos" ON public.team_members;
DROP POLICY IF EXISTS "Admins podem inserir membros" ON public.team_members;
DROP POLICY IF EXISTS "Admins podem atualizar membros" ON public.team_members;
DROP POLICY IF EXISTS "Admins podem deletar membros" ON public.team_members;

CREATE POLICY "Public can view active team members"
ON public.team_members
FOR SELECT
USING (active = true OR public.is_admin());

CREATE POLICY "Admins can manage team members"
ON public.team_members
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10. Otimizar event_templates
DROP POLICY IF EXISTS "Admins podem ver templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins podem criar templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins podem atualizar templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins podem deletar templates" ON public.event_templates;

CREATE POLICY "Admins can manage event templates"
ON public.event_templates
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 11. Otimizar site_settings
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.site_settings;

CREATE POLICY "Anyone can view settings"
ON public.site_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.site_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 12. Otimizar news_sources
DROP POLICY IF EXISTS "Admins can manage news sources" ON public.news_sources;

CREATE POLICY "Admins can manage news sources"
ON public.news_sources
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 13. Criar índices para otimizar queries RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_custom_links_enabled ON public.custom_links(enabled);
CREATE INDEX IF NOT EXISTS idx_link_groups_enabled ON public.link_groups(enabled);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members(active);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_newsletter_variants_enabled ON public.newsletter_popup_variants(enabled);