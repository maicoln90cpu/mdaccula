-- Agendamento de disparo (aba "Envio manual") — cron job que roda a cada
-- 5 minutos e chama send-scheduled-email-campaigns para processar os
-- envios com scheduled_at vencido. Mesmo padrão de segredo/cron dos jobs
-- de digest (ver 20260710002509_...sql).

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('scheduled_email_send_cron', '5aMztEdjlP7gY_pIK6NQicjHRVAYOtAo4rPS9p5Hgrg')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'scheduled-email-send-poll-5min'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'scheduled-email-send-poll-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/send-scheduled-email-campaigns',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','scheduled-email-send',
      'x-cron-secret','5aMztEdjlP7gY_pIK6NQicjHRVAYOtAo4rPS9p5Hgrg'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
