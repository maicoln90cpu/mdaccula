-- ================================================
-- FIX: Políticas RLS para Service Role
-- ================================================
-- Este arquivo adiciona políticas que permitem operações via 
-- service_role key para o sync externo funcionar corretamente
--
-- IMPORTANTE: Execute este script no Supabase EXTERNO (destino do backup)
-- após criar as tabelas com o tabelas.md
--
-- O service_role bypassa RLS por padrão, mas é boa prática
-- documentar explicitamente as permissões
-- ================================================

-- PROFILES
CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- USER_ROLES
CREATE POLICY "Service role can manage user_roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- TEAM_MEMBERS
CREATE POLICY "Service role can manage team_members"
ON public.team_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- LINK_GROUPS
CREATE POLICY "Service role can manage link_groups"
ON public.link_groups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- CUSTOM_LINKS
CREATE POLICY "Service role can manage custom_links"
ON public.custom_links
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- EVENTS
CREATE POLICY "Service role can manage events"
ON public.events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- BLOG_POSTS
CREATE POLICY "Service role can manage blog_posts"
ON public.blog_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- BLOG_POST_LIKES
CREATE POLICY "Service role can manage blog_post_likes"
ON public.blog_post_likes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- AI_PROMPT_TEMPLATES
CREATE POLICY "Service role can manage ai_prompt_templates"
ON public.ai_prompt_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- AI_GENERATED_POSTS
CREATE POLICY "Service role can manage ai_generated_posts"
ON public.ai_generated_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- NEWS_SOURCES
CREATE POLICY "Service role can manage news_sources"
ON public.news_sources
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- NEWSLETTER_POPUP_VARIANTS
CREATE POLICY "Service role can manage newsletter_popup_variants"
ON public.newsletter_popup_variants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- NEWSLETTER_SUBSCRIBERS
CREATE POLICY "Service role can manage newsletter_subscribers"
ON public.newsletter_subscribers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- NEWSLETTER_POPUP_ANALYTICS
CREATE POLICY "Service role can manage newsletter_popup_analytics"
ON public.newsletter_popup_analytics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SHARE_ANALYTICS
CREATE POLICY "Service role can manage share_analytics"
ON public.share_analytics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SITE_SETTINGS
CREATE POLICY "Service role can manage site_settings"
ON public.site_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SYNC_LOGS
CREATE POLICY "Service role can manage sync_logs"
ON public.sync_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- Execute este comando para verificar se as políticas foram criadas:
-- 
-- SELECT tablename, policyname, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND policyname LIKE '%service_role%'
-- ORDER BY tablename;
-- ================================================
