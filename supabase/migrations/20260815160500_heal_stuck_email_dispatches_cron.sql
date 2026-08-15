-- R-062 — cron job que roda a cada 5 minutos e chama
-- heal-stuck-email-dispatches para destravar linhas de event_email_campaigns
-- presas em 'in_progress' (function morta sem exceção, entre o claim do
-- evento e a confirmação de criação na E-goi). Mesmo padrão de segredo/cron
-- do job de scheduled-email-send (20260717170000_scheduled_email_send_cron.sql).

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('heal_stuck_email_dispatches_cron', 'QN3zgGNnW9g3OYxBoXQJKonYDVQx13QVC5vCB5mqdec')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'heal-stuck-email-dispatches-5min'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'heal-stuck-email-dispatches-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/heal-stuck-email-dispatches',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','heal-stuck-email-dispatches',
      'x-cron-secret','QN3zgGNnW9g3OYxBoXQJKonYDVQx13QVC5vCB5mqdec'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
