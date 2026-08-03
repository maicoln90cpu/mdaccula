-- =========================================================
-- FASE 2: funções administrativas fora do alcance do público
-- =========================================================

-- get_db_size: apenas rotinas internas (edge functions / cron)
REVOKE ALL ON FUNCTION public.get_db_size() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_db_size() TO service_role;

-- cleanup_old_egress: apenas rotinas internas (cron)
REVOKE ALL ON FUNCTION public.cleanup_old_egress() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_egress() TO service_role;

-- cleanup_old_logs: usado pelo botão de limpeza no painel admin.
-- Passa a exigir admin dentro da própria função + sem acesso anônimo.
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a limpeza de logs';
  END IF;

  DELETE FROM public.application_logs WHERE logged_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.performance_metrics WHERE measured_at < NOW() - INTERVAL '7 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO authenticated, service_role;

-- =========================================================
-- FASE 3: buckets públicos - permitir imagem por URL, bloquear listagem
-- =========================================================
-- Buckets continuam públicos (URL direta é servida sem passar por RLS).
-- A policy de SELECT em storage.objects só é usada por list()/download()
-- autenticado, então restringi-la a admin bloqueia a listagem pública
-- sem afetar a exibição das imagens no site.

DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
CREATE POLICY "Admins can list event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Link thumbnails são públicas" ON storage.objects;
CREATE POLICY "Admins can list link thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'link-thumbnails' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Imagens de equipe são públicas" ON storage.objects;
CREATE POLICY "Admins can list team images"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-images' AND public.has_role(auth.uid(), 'admin'));