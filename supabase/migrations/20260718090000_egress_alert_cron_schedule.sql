-- Agenda o cron diário de alerta de egress (egress-alert-cron), que existia
-- no código mas nunca tinha sido efetivamente agendado via pg_cron — por
-- isso a aba "Alertas" do Monitor de Egress ficava sempre vazia. Mesmo
-- padrão de segredo/cron já usado para os outros jobs (ver
-- 20260717170000_scheduled_email_send_cron.sql).

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('egress_alert_cron', 'vCjs6uLQrf4pr9XVNO_FhsvrB_DYRjprPM5ZtODBxgU')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'egress-alert-daily-09h-brt'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'egress-alert-daily-09h-brt',
  '0 12 * * *', -- 12:00 UTC = 09:00 BRT (Brasil sem horário de verão)
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/egress-alert-cron',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','egress-alert-cron',
      'x-cron-secret','vCjs6uLQrf4pr9XVNO_FhsvrB_DYRjprPM5ZtODBxgU'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
