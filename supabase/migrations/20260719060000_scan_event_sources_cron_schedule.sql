-- Agenda o scan diário de fontes de eventos (scan-event-sources / Event
-- Watcher), que existia no código e já aceita autenticação de cron
-- (authorizeAdminOrCron, cronSecretRowName='scan_event_sources_cron') mas
-- nunca tinha sido efetivamente agendado via pg_cron — por isso a marca
-- MDAccula (compose-event-image, barra+logo) nunca era aplicada
-- automaticamente e nenhum evento novo era descoberto sozinho. Só rodou
-- manualmente algumas vezes até aqui. Mesmo padrão já usado pelos outros
-- crons de conteúdo (ver 20260718090000_egress_alert_cron_schedule.sql).

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('scan_event_sources_cron', 'LZrC3P0PWl0FOfyw2NjzftfbPqD74JsKBDMXXOe8')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'scan-event-sources-daily-08h-brt'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'scan-event-sources-daily-08h-brt',
  '0 11 * * *', -- 11:00 UTC = 08:00 BRT (Brasil sem horário de verão)
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/scan-event-sources',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','scan-event-sources-cron',
      'x-cron-secret','LZrC3P0PWl0FOfyw2NjzftfbPqD74JsKBDMXXOe8'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
