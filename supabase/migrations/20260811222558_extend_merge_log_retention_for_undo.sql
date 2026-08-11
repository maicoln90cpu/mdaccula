-- Corrige descompasso entre a limpeza diária de application_logs (7 dias)
-- e a janela de 90 dias que MergedEventsTab consulta para habilitar o
-- botão "Desfazer" mesclagem. Sem isso, o snapshot de merge_events some
-- do log antes da UI conseguir reverter, obrigando a corrigir via SQL manual.
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

  -- Logs de mesclagem de eventos guardam o snapshot usado pelo botão
  -- "Desfazer" no admin (MergedEventsTab) e ficam retidos por 90 dias,
  -- mesma janela de tempo que a tela consulta.
  DELETE FROM public.application_logs
  WHERE logged_at < NOW() - INTERVAL '7 days'
    AND COALESCE(context->>'action', '') NOT IN ('merge_events', 'undo_merge');

  DELETE FROM public.application_logs
  WHERE logged_at < NOW() - INTERVAL '90 days'
    AND context->>'action' IN ('merge_events', 'undo_merge');

  DELETE FROM public.performance_metrics WHERE measured_at < NOW() - INTERVAL '7 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO authenticated, service_role;
