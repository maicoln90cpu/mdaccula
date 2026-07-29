-- 1) redirect_click_events depende da política permissiva para inserir; cria a política correta antes
CREATE POLICY "Anyone can insert redirect clicks"
ON public.redirect_click_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2) Restringe as políticas "Service role can manage ..." ao service_role
DROP POLICY IF EXISTS "Service role can manage blog_view_events" ON public.blog_view_events;
CREATE POLICY "Service role can manage blog_view_events"
ON public.blog_view_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage event_view_events" ON public.event_view_events;
CREATE POLICY "Service role can manage event_view_events"
ON public.event_view_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage link_click_events" ON public.link_click_events;
CREATE POLICY "Service role can manage link_click_events"
ON public.link_click_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage redirect_click_events" ON public.redirect_click_events;
CREATE POLICY "Service role can manage redirect_click_events"
ON public.redirect_click_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Garante grants coerentes (inserção anônima + leitura admin via policies)
GRANT INSERT ON public.blog_view_events TO anon, authenticated;
GRANT SELECT ON public.blog_view_events TO authenticated;
GRANT ALL ON public.blog_view_events TO service_role;

GRANT INSERT ON public.event_view_events TO anon, authenticated;
GRANT SELECT ON public.event_view_events TO authenticated;
GRANT ALL ON public.event_view_events TO service_role;

GRANT INSERT ON public.link_click_events TO anon, authenticated;
GRANT SELECT ON public.link_click_events TO authenticated;
GRANT ALL ON public.link_click_events TO service_role;

GRANT INSERT ON public.redirect_click_events TO anon, authenticated;
GRANT SELECT ON public.redirect_click_events TO authenticated;
GRANT ALL ON public.redirect_click_events TO service_role;

-- 4) Aviso: leitura de regras de bloqueio de e-mail restrita a admin
DROP POLICY IF EXISTS "Authenticated can read global blocks" ON public.email_global_blocks;
CREATE POLICY "Admins can read global blocks"
ON public.email_global_blocks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));