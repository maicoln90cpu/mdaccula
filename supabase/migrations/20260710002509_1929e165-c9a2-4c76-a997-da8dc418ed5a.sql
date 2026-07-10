
-- B.11: Digest semanal — segredo do cron + site_setting toggle + job pg_cron (quinta 21:00 UTC = 18:00 BRT)

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('weekly_digest_cron', 'Bc0KQ3sGrieNc2wEqsX88oQxI8EuBxwZy2-jAIioq7w')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

INSERT INTO public.site_settings (key, value)
VALUES ('weekly_digest_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Remove versões antigas do job caso existam (idempotência)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'weekly-digest-thursday-18h-brt'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'weekly-digest-thursday-18h-brt',
  '0 21 * * 4',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/weekly-digest-draft',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','weekly-digest',
      'x-cron-secret','Bc0KQ3sGrieNc2wEqsX88oQxI8EuBxwZy2-jAIioq7w'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
