-- Remover jobs com mesmo nome se já existirem (idempotente)
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('cleanup-egress-weekly','cleanup-storage-weekly','cleanup-sync-logs-weekly')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- 1) Limpeza de egress_metrics > 90 dias
SELECT cron.schedule(
  'cleanup-egress-weekly',
  '30 3 * * 0',
  $$ SELECT public.cleanup_old_egress(); $$
);

-- 2) Edge function cleanup-storage
SELECT cron.schedule(
  'cleanup-storage-weekly',
  '0 4 * * 0',
  $$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/cleanup-storage',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdnB1emxzcHZ2c21tdW56bnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY0NjksImV4cCI6MjA4NzA5MjQ2OX0.flQdwVzpNiSxOO0GKl1VDBeBsP5wR8uGatn7CxFOZDg"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);

-- 3) Edge function cleanup-sync-logs
SELECT cron.schedule(
  'cleanup-sync-logs-weekly',
  '15 4 * * 0',
  $$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/cleanup-sync-logs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdnB1emxzcHZ2c21tdW56bnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY0NjksImV4cCI6MjA4NzA5MjQ2OX0.flQdwVzpNiSxOO0GKl1VDBeBsP5wR8uGatn7CxFOZDg"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);