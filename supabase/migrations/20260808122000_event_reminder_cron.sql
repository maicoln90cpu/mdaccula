-- Item 5 da melhoria de disparo de e-mail — cron horário que aciona a nova
-- automação "Lembrete de evento" (send-event-reminder-campaigns). Mesmo
-- padrão de segredo/cron do poller de agendamento manual
-- (20260717170000_scheduled_email_send_cron.sql): granularidade de dia (não
-- minuto) então roda de hora em hora, e a própria function decide se é a
-- hora configurada (site_settings.event_reminder_hour) antes de fazer
-- qualquer trabalho.

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('event_reminder_cron', 'KBfeP6eFWJgDlzD6V5bZfma-zLeNXL4PIpweVHFT7o4')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'event-reminder-poll-hourly'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'event-reminder-poll-hourly',
  '5 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/send-event-reminder-campaigns',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','event-reminder',
      'x-cron-secret','KBfeP6eFWJgDlzD6V5bZfma-zLeNXL4PIpweVHFT7o4'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
