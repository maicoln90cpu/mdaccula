-- ================================================
-- Fase 2: Correções de Segurança RLS
-- Restringir INSERT em tabelas de analytics
-- ================================================

-- 1. sync_logs: Apenas service_role pode inserir
-- (Remove política pública de INSERT)
DROP POLICY IF EXISTS "System can insert sync logs" ON public.sync_logs;

CREATE POLICY "Only service role can insert sync logs"
ON public.sync_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. share_analytics: Restringir INSERT
-- A inserção só pode acontecer via edge function (track-share)
-- que já usa service_role. Removemos o acesso direto anônimo.
DROP POLICY IF EXISTS "Anyone can track shares" ON public.share_analytics;

CREATE POLICY "Service role can insert share analytics"
ON public.share_analytics
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. newsletter_popup_analytics: Restringir INSERT
-- A inserção só pode acontecer via edge function
-- que já usa service_role. Removemos o acesso direto anônimo.
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.newsletter_popup_analytics;

CREATE POLICY "Service role can insert newsletter analytics"
ON public.newsletter_popup_analytics
FOR INSERT
TO service_role
WITH CHECK (true);

-- ================================================
-- Verificação: Listar políticas atualizadas
-- ================================================
-- Execute após a migration para confirmar:
-- SELECT tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('sync_logs', 'share_analytics', 'newsletter_popup_analytics')
-- ORDER BY tablename, policyname;